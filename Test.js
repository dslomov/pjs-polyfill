if (typeof(libdir) === "undefined") { load("Util.js"); } else { load(libdir+"/"+"Util.js"); }

function oneDimensionalArrayOfUints() {
  var grain = uint32;
  var type = new ArrayType(grain, 4);
  var r1 = type.build(x => x * 2);
  var r2 = type.build((x, out) => Handle.set(out, x * 2));
  assertTypedEqual(type, r1, new type([0, 2, 4, 6]));
  assertTypedEqual(type, r1, r2);
}

function oneDimensionalArrayOfStructs() {
  var grain = new StructType({f: uint32});
  var type = new ArrayType(grain, 4);
  var r1 = type.build(x => new grain({f: x * 2}));
  var r2 = type.build((x, out) => { out.f = x * 2; });
  assertTypedEqual(type, r1, new type([{f:0}, {f:2},
                                       {f:4}, {f:6}]));
  assertTypedEqual(type, r1, r2);
}

function twoDimensionalArrayOfStructsWithDepth2() {
  var grain = new StructType({f: uint32});
  var type = new ArrayType(new ArrayType(grain, 2), 2);

  var r1 = type.build(2, (x, y) => {
    return new grain({f: x * 10 + y});
  });

  var r2 = type.build(2, (x, y, out) => {
    out.f = x * 10 + y;
  });

  assertTypedEqual(type, r1, new type([[{f:00}, {f:01}],
                                       [{f:10}, {f:11}]]));
  assertTypedEqual(type, r1, r2);
}

function twoDimensionalArrayOfStructsWithDepth1() {
  var grain = new ArrayType(new StructType({f: uint32}), 2);
  var type = new ArrayType(grain, 2);

  var r1 = type.build((x) => {
    return new grain([{f: x * 10},
                      {f: x * 10 + 1}]);
  });

  var r2 = type.build(1, (x, out) => {
    out[0].f = x * 10 + 0;
    out[1].f = x * 10 + 1;
  });

  assertTypedEqual(type, r1, new type([[{f:00}, {f:01}],
                                       [{f:10}, {f:11}]]));
  assertTypedEqual(type, r1, r2);
}

function reduceUint8s() {
  var uint8Array = new ArrayType(uint8, 5);
  var array = new uint8Array([128, 129, 130, 131, 132]);

  var sum = array.reducePar((a, b) => a + b);
  assertEq(sum, (128+129+130+131+132) % 256);

  // var sum = array.reducePar(float64, (a, b) => a + b);
  // assertEq(sum, 128+129+130+131+132);
}

function reduceVectors() {
  var VectorType = new ArrayType(uint32, 3);
  var VectorsType = new ArrayType(VectorType, 3);
  var array = new VectorsType([[1, 2, 3],
                               [4, 5, 6],
                               [7, 8, 9]]);

  var sum = array.reducePar(vectorAdd);
  assertTypedEqual(VectorType,
                   sum,
                   new VectorType([1+4+7,
                                   2+5+8,
                                   3+6+9]));

  var sum = array.reducePar(vectorAddFunctional);
  assertTypedEqual(VectorType,
                   sum,
                   new VectorType([1+4+7,
                                   2+5+8,
                                   3+6+9]));

  function vectorAdd(l, r) {
    assertEq(l.length, r.length);
    for (var i = 0; i < l.length; i++)
      l[i] += r[i];
  }

  function vectorAddFunctional(l, r) {
    assertEq(l.length, r.length);
    return VectorType.build(1, i => l[i] + r[i]);
  }

}

function scatterUint8sPermute() {
  var uint8Array = new ArrayType(uint8, 5);
  var array = new uint8Array([124, 120, 122, 123, 121]);

  var perm = array.scatterPar(uint8Array, [4, 0, 2, 3, 1]);
  assertTypedEqual(uint8Array, perm, [120, 121, 122, 123, 124]);
}

function scatterUint8sPermuteIncomplete() {
  var uint8Array4 = new ArrayType(uint8, 4);
  var uint8Array5 = new ArrayType(uint8, 5);
  var array = new uint8Array4([124, 120, 122, 123]);

  var perm;
  perm = array.scatterPar(uint8Array5, [4, 0, 2, 3]);
  assertTypedEqual(uint8Array5, perm, [120,  0, 122, 123, 124]);

  perm = array.scatterPar(uint8Array5, [4, 0, 2, 3], 77);
  assertTypedEqual(uint8Array5, perm, [120, 77, 122, 123, 124]);
}

function scatterUint8sHistogram() {
  var uint32Array5 = new ArrayType(uint32, 5);
  var uint32Array3 = new ArrayType(uint32, 3);
  var array = new uint32Array5([1, 10, 100, 1000, 10000]);

  var hist = array.scatterPar(uint32Array3, [1, 1, 2, 1, 0], 0, (a,b) => a+b);
  assertTypedEqual(uint32Array3, hist, [10000, 1011, 100]);
}

function scatterUint8sCollisionThrows() {
  var uint32Array5 = new ArrayType(uint32, 5);
  var uint32Array3 = new ArrayType(uint32, 3);
  var array = new uint32Array5([1, 10, 100, 1000, 10000]);

  var unset_nonce = new Object();
  var unset = unset_nonce;
  try {
    unset = array.scatterPar(uint32Array3, [1, 1, 2, 1, 0], 0);
  } catch (e) {
    assertEq(unset, unset_nonce);
  }
}

function scatterUint8sConflictIsAssocNonCommute() {
  var uint32Array5 = new ArrayType(uint32, 5);
  var uint32Array3 = new ArrayType(uint32, 3);
  var array = new uint32Array5([1, 10, 100, 1000, 10000]);

  // FIXME strawman spec says conflict must be associative, but does
  // not dictate commutative.  Yet, strawman spec does not appear to
  // specify operation order; must address incongruence.

  var lfts = array.scatterPar(uint32Array3, [1, 1, 2, 1, 0], 0, (a,b) => a);
  assertTypedEqual(uint32Array3, lfts, [10000, 1, 100]);
  var rgts = array.scatterPar(uint32Array3, [1, 1, 2, 1, 0], 0, (a,b) => b);
  assertTypedEqual(uint32Array3, rgts, [10000, 1000, 100]);
}


try {

  oneDimensionalArrayOfUints();

  oneDimensionalArrayOfStructs();

  twoDimensionalArrayOfStructsWithDepth2();

  twoDimensionalArrayOfStructsWithDepth1();

  reduceUint8s();

  reduceVectors();


  scatterUint8sPermute();
  scatterUint8sPermuteIncomplete();
  scatterUint8sHistogram();
  scatterUint8sCollisionThrows();
  scatterUint8sConflictIsAssocNonCommute();

} catch (e) {
  print(e.name);
  print(e.message);
  print(e.stack);
  throw e;
}
