import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import cors from '@fastify/cors';
import { ZKPService } from './zkp-service.js';
import { ValidationService } from './validation-service.js';
import { SecurityService } from './security-service.js';
import { Logger } from './utils/logger.js';
import dotenv from 'dotenv';

dotenv.config();

const fastify = Fastify({
    logger: true,
    trustProxy: true,
    requestIdLogLabel: 'reqId',
    disableRequestLogging: process.env.NODE_ENV === 'production'
});

// Register plugins
await fastify.register(multipart);
await fastify.register(cors, {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-ID']
});

// Initialize services
const zkpService = new ZKPService();
const validationService = new ValidationService();
const securityService = new SecurityService();
const logger = new Logger('ZKP-Server');

// Middleware for request validation and security
fastify.addHook('preHandler', async (request, reply) => {
    // Rate limiting and security checks
    const clientIP = request.ip;
    const sessionId = request.headers['x-session-id'];
    
    if (!securityService.checkRateLimit(clientIP)) {
        reply.code(429).send({ error: 'Rate limit exceeded' });
        return;
    }
    
    // Log request (without sensitive data)
    logger.info('Request received', {
        method: request.method,
        url: request.url,
        ip: clientIP,
        sessionId: sessionId,
        userAgent: request.headers['user-agent']
    });
});

// Health check endpoint
fastify.get('/health', async (request, reply) => {
    return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'zkp-master',
        version: process.env.npm_package_version || '0.1.0'
    };
});

// Get circuit information
fastify.get('/api/v1/circuits', async (request, reply) => {
    try {
        const circuits = await zkpService.getAvailableCircuits();
        return {
            circuits,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        logger.error('Failed to get circuits', { error: error.message });
        reply.code(500).send({ error: 'Internal server error' });
    }
});

// Generate master proof - Main endpoint
fastify.post('/api/v1/zk/master_prove', async (request, reply) => {
    const sessionId = request.headers['x-session-id'] || `session_${Date.now()}`;
    
    try {
        // Validate request schema
        const validationResult = validationService.validateMasterProveRequest(request.body);
        if (!validationResult.valid) {
            reply.code(400).send({
                error: 'Invalid request format',
                details: validationResult.errors
            });
            return;
        }
        
        const { modules, policy, options = {} } = request.body;
        
        logger.info('Master proof generation started', {
            sessionId,
            moduleCount: modules.length,
            policy: policy.required
        });
        
        // Security validation
        const securityCheck = securityService.validateModules(modules);
        if (!securityCheck.valid) {
            reply.code(400).send({
                error: 'Security validation failed',
                details: securityCheck.errors
            });
            return;
        }
        
        // Generate master proof
        const startTime = Date.now();
        const masterProof = await zkpService.generateMasterProof({
            sessionId,
            modules,
            policy,
            options,
            timestamp: Math.floor(Date.now() / 1000)
        });
        
        const generationTime = Date.now() - startTime;
        
        logger.info('Master proof generated successfully', {
            sessionId,
            generationTime,
            commitment: masterProof.commitment
        });
        
        // Secure cleanup
        securityService.secureDelete(request.body);
        
        return masterProof;
        
    } catch (error) {
        logger.error('Master proof generation failed', {
            sessionId,
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
        
        // Secure cleanup on error
        securityService.secureDelete(request.body);
        
        reply.code(500).send({
            error: 'Proof generation failed',
            sessionId,
            timestamp: new Date().toISOString()
        });
    }
});

// Verify master proof
fastify.post('/api/v1/zk/verify', async (request, reply) => {
    try {
        const { proof, publicSignals, verificationKey } = request.body;
        
        if (!proof || !publicSignals) {
            reply.code(400).send({ error: 'Missing proof or public signals' });
            return;
        }
        
        const isValid = await zkpService.verifyProof(proof, publicSignals, verificationKey);
        
        return {
            valid: isValid,
            timestamp: new Date().toISOString()
        };
        
    } catch (error) {
        logger.error('Proof verification failed', { error: error.message });
        reply.code(500).send({ error: 'Verification failed' });
    }
});

// Get verification key for a circuit
fastify.get('/api/v1/zk/verification-key/:circuitId', async (request, reply) => {
    try {
        const { circuitId } = request.params;
        const verificationKey = await zkpService.getVerificationKey(circuitId);
        
        if (!verificationKey) {
            reply.code(404).send({ error: 'Circuit not found' });
            return;
        }
        
        return {
            circuitId,
            verificationKey,
            timestamp: new Date().toISOString()
        };
        
    } catch (error) {
        logger.error('Failed to get verification key', { 
            circuitId: request.params.circuitId,
            error: error.message 
        });
        reply.code(500).send({ error: 'Internal server error' });
    }
});

// Generate module commitment (utility endpoint for modules)
fastify.post('/api/v1/zk/commitment', async (request, reply) => {
    try {
        const { data, nonce } = request.body;
        
        if (!data || !nonce) {
            reply.code(400).send({ error: 'Missing data or nonce' });
            return;
        }
        
        const commitment = await zkpService.generateCommitment(data, nonce);
        
        // Secure cleanup
        securityService.secureDelete(request.body);
        
        return {
            commitment,
            timestamp: new Date().toISOString()
        };
        
    } catch (error) {
        logger.error('Commitment generation failed', { error: error.message });
        securityService.secureDelete(request.body);
        reply.code(500).send({ error: 'Commitment generation failed' });
    }
});

// Error handler
fastify.setErrorHandler((error, request, reply) => {
    logger.error('Unhandled error', {
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        method: request.method,
        url: request.url
    });
    
    reply.code(500).send({
        error: 'Internal server error',
        timestamp: new Date().toISOString()
    });
});

// Graceful shutdown
const shutdown = async (signal) => {
    logger.info(`Received ${signal}, shutting down gracefully`);
    
    try {
        await fastify.close();
        logger.info('Server closed successfully');
        process.exit(0);
    } catch (error) {
        logger.error('Error during shutdown', { error: error.message });
        process.exit(1);
    }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start server
const start = async () => {
    try {
        const port = process.env.PORT || 3001;
        const host = process.env.HOST || '0.0.0.0';
        
        await fastify.listen({ port: parseInt(port), host });
        
        logger.info(`ZKP Master server listening on ${host}:${port}`);
        logger.info(`Health check: http://${host}:${port}/health`);
        logger.info(`API docs: http://${host}:${port}/api/v1/circuits`);
        
    } catch (error) {
        logger.error('Failed to start server', { error: error.message });
        process.exit(1);
    }
};

start();