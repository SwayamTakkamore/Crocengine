pragma circom 2.0.0;

include "node_modules/circomlib/circuits/poseidon.circom";

// Simple test with poseidon
template PoseidonTest() {
    signal input a;
    signal input b;
    signal output hash;
    
    component hasher = Poseidon(2);
    hasher.inputs[0] <== a;
    hasher.inputs[1] <== b;
    
    hash <== hasher.out;
}

component main = PoseidonTest();