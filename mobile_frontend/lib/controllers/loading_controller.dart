import 'package:flutter/material.dart';
import 'dart:math' as math;
import '../theme.dart';

class CrocodileGlowLoader extends StatefulWidget {
  final String crocodileAsset;
  final double size;
  final double crocodileSize;
  final Color glowColor;

  const CrocodileGlowLoader({
    super.key,
    required this.crocodileAsset,
    this.size = 150,
    this.crocodileSize = 40,
    this.glowColor = AppTheme.emerald,
  });

  @override
  State<CrocodileGlowLoader> createState() => _CrocodileGlowLoaderState();
}

class _CrocodileGlowLoaderState extends State<CrocodileGlowLoader>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (_, child) {
        double angle = _controller.value * 2 * math.pi;

        double radius = widget.size / 2 - widget.crocodileSize / 2 - 4;

        double cx = widget.size / 2 + radius * math.cos(angle);
        double cy = widget.size / 2 + radius * math.sin(angle);

        return SizedBox(
          width: widget.size,
          height: widget.size,
          child: Stack(
            children: [
              CustomPaint(
                size: Size(widget.size, widget.size),
                painter: GlowingArcPainter(
                  progress: _controller.value,
                  color: widget.glowColor,
                  strokeWidth: 6,
                  radiusOffset: widget.crocodileSize / 2 + 4,
                ),
              ),

              Positioned(
                left: cx - widget.crocodileSize / 2,
                top: cy - widget.crocodileSize / 2,
                child: Transform.rotate(
                  angle: angle + math.pi / 2 + 45,
                  child: Image.asset(
                    widget.crocodileAsset,
                    height: widget.crocodileSize,
                    width: widget.crocodileSize,
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class GlowingArcPainter extends CustomPainter {
  final double progress;
  final Color color;
  final double strokeWidth;
  final double radiusOffset;

  GlowingArcPainter({
    required this.progress,
    required this.color,
    this.strokeWidth = 6,
    this.radiusOffset = 20,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2 - radiusOffset;

    final gradient = SweepGradient(
      startAngle: 0,
      endAngle: 2 * math.pi,
      colors: [
        Colors.transparent,
        color.withValues(alpha: 0.2),
        color.withValues(alpha: 0.9),
      ],
      stops: const [0.2, 0.6, 1.0],
      transform: GradientRotation(2 * math.pi * progress),
    );

    final paint =
        Paint()
          ..shader = gradient.createShader(
            Rect.fromCircle(center: center, radius: radius),
          )
          ..style = PaintingStyle.stroke
          ..strokeWidth = strokeWidth
          ..strokeCap = StrokeCap.round;

    canvas.drawCircle(center, radius, paint);
  }

  @override
  bool shouldRepaint(GlowingArcPainter oldDelegate) => true;
}
