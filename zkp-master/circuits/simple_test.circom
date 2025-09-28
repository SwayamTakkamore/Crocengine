pragma circom 2.0.0;

// Very simple test circuit without external dependencies
template SimpleTest() {
    signal input a;
    signal input b;
    signal output c;
    
    c <== a + b;
}

component main = SimpleTest();