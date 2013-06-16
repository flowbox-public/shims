// memory management and pointer emulation

// slice an array of heap objects
var h$sliceArray = /* ArrayBuffer.prototype.slice ?
  function(a, start, n) {
    return new Int32Array(a.buffer.slice(start, n));
  }
  : */
  function(a, start, n) {
    var tgt = [];
    for(var i=0;i<n;i++) {
      tgt[i] = a[start+i];
    }
    return tgt;
  }


function h$memcpy() {
  if(arguments.length === 3) {  // ByteArray# -> ByteArray# copy
    var dst = arguments[0];
    var src = arguments[1];
    var n   = arguments[2];
    for(var i=n-1;i>=0;i--) {
      dst.u8[i] = src.u8[i];
    }
    ret1 = 0;
    return dst;
  } else if(arguments.length === 5) { // Addr# -> Addr# copy
    var dst = arguments[0];
    var dst_off = arguments[1]
    var src = arguments[2];
    var src_off = arguments[3];
    var n   = arguments[4];
    for(var i=n-1;i>=0;i--) {
      dst.u8[i+dst_off] = src.u8[i+src_off];
    }
    ret1 = dst_off;
    return dst;
  } else {
    throw "h$memcpy: unexpected argument";
  }
}

function h$memchr(a_v, a_o, c, n) {
  for(var i=0;i<n;i++) {
    if(a_v.u8[a_o+i] === c) {
      h$ret1 = a_o+i;
      return a_v;
    }
  }
  h$ret1 = 0;
  return null;
}

function h$strlen(a_v, a_o) {
  var i=0;
  while(true) {
    if(a_v.u8[a_o+i] === 0) { return i; }
    i++;
  }
}

function h$fps_reverse(a_v, a_o, b_v, b_o, n) {
  for(var i=0;i<n;i++) {
    a_v.u8[a_o+n-i-1] = b_v.u8[b_o+i];
  }
}

function h$fps_intersperse(a_v,a_o,b_v,b_o,n,c) {
  var dst_o = a_o;
  for(var i=0;i<n-1;i++) {
    a_v.u8[dst_o] = b_v.u8[b_o+i];
    a_v.u8[dst_o+1] = c;
    dst_o += 2;
  }
  if(n > 0) {
    a_v.u8[dst_o] = v_c.u8[b_o+n-1];
  }
}

function h$fps_maximum(a_v,a_o,n) {
  var max = a_v.u8[a_o];
  for(var i=1;i<n;i++) {
    var c = a_v.u8[a_o+i];
    if(c > max) { max = c; }
  }
  return max;
}

function h$fps_minimum(a_v,a_o,n) {
  var min = a_v.u8[a_o];
  for(var i=1;i<n;i++) {
    var c = a_v.u8[a_o+i];
    if(c < min) { min = c; }
  }
  return min;
}

function h$fps_count(a_v,a_o,n,c) {
  var count = 0;
  for(var i=0;i<n;i++) {
    if(a_v.u8[a_o+i] === c) { count++; }
  }
  return count|0;
}

function h$newArray(len,e) {
  var r = [];
  for(var i=0;i<len;i++) { r[i] = e; }
  return r;
}

function h$roundUpToMultipleOf(n,m) {
  var rem = n % m;
  return rem === 0 ? n : n - rem + m;
}

function h$newByteArray(len) {
  var len0 = Math.max(h$roundUpToMultipleOf(len, 8), 8);
  var buf = new ArrayBuffer(len0);
  return { buf: buf
         , len: len
         , i3: new Int32Array(buf)
         , u8: new Uint8Array(buf)
         , u1: new Uint16Array(buf)
         , f3: new Float32Array(buf)
         , f6: new Float64Array(buf)
         , dv: new DataView(buf)
         }
}

// wrap an ArrayBuffer so that it can be used as a ByteArray#
// with the most common view prespun
// offset and length are optional, both are in bytes
// offset must be in multiples of 4
function h$wrapBuffer(buf, offset, length) {
  var len0 = Math.max(h$roundUpToMultipleOf(len, 8), 8);
  if(offset) {
    if(length) {
      return { buf: buf
             , len: length
             , i3: new Int32Array(buf, offset, length >> 2)
             , u8: new Uint8Array(buf, offset, length)
             , u1: new Uint16Array(buf, offset, length >> 1)
             , f3: new Float32Array(buf, offset, length >> 2)
             , f6: new Float64Array(buf, offset, length >> 3)
             , dv: new DataView(buf, offset, length)
             };
    } else {
      return { buf: buf
             , len: buf.byteLength - offset
             , i3: new Int32Array(buf, offset)
             , u8: new Uint8Array(buf, offset)
             , u1: new Uint16Array(buf, offset)
             , f3: new Float32Array(buf, offset)
             , f6: new Float64Array(buf, offset)
             , dv: new DataView(buf, offset)
             };
    }
  } else if(length) {
    return { buf: buf
           , len: length
           , i3: new Int32Array(buf, 0, length >> 2)
           , u8: new Uint8Array(buf, 0, length)
           , u1: new Uint16Array(buf, 0, length >> 1)
           , f3: new Float32Array(buf, offset, length >> 2)
           , f6: new Float64Array(buf, offset, length >> 3)
           , dv: new DataView(buf, 0, length)
           };
  } else {
    return { buf: buf
           , len: buf.byteLength
           , i3: new Int32Array(buf)
           , u8: new Uint8Array(buf)
           , u1: new Uint16Array(buf)
           , f3: new Float32Array(buf)
           , f6: new Float64Array(buf)
           , dv: new DataView(buf)
           };
  }
}

// try to compute a reasonably unique int key from object data
// used to calculate the StableName int
// note: be careful to not use any mutable properties for this
// - numbers directly on the heap shouldn't change
// - o.m >> 2 shouldn't change if it's nonzero
h$stableNameN = 1;
// semi-unique in the upper 14 bits of the .m thing
function h$getObjectKey(o) {
  var x = o.m;
  if(o.m >> 18 === 0) {
    o.m |= ++h$stableNameN << 18;
  }
  return o.m >> 18;
}

function h$getObjectHash(o) {
  if(o === null) {
    return 230948;
  } if(typeof o === 'number') {
    return o|0;
  } else if(typeof o === 'object' && o.hasOwnProperty('m') && typeof o.m === 'number') {
    return h$getObjectKey(o);
  } else {
    return 3456333333;
  }
}

function h$makeStableName(x) {
  if(typeof x === 'object') {
    return [x,x.f];
  } else {
    return [x,null];
  }
}

function h$stableNameInt(s) {
  var s0 = s[0];
  if(typeof s0 === 'boolean') { return s0?1:0; }
  if(typeof s0 === 'number') { return s0|0; } // fixme this won't work well with small floats 
  var hash = 23;
  hash = (hash * 37 + h$getObjectKey(s.f))|0;
  hash = (hash * 37 + h$getObjectHash(s.d1))|0;
  hash = (hash * 37 + h$getObjectHash(s.d2))|0;
  return hash;
}

function h$eqStableName(s1o,s2o) {
  var s1 = s1o[0];
  var s2 = s2o[0];
  if(typeof s1 !== 'object' || typeof s2 !== 'object') {
    return s1 === s2 ? 1 : 0;
  }
  var s1f = s1o[1];
  var s2f = s2o[1];
  return (s1f === s2f && (s1 === s2 || (s1.f === s2.f && s1.d1 === s2.d1 && s1.d2 === s2.d2)))?1:0;
}

function h$makeStablePtr(v) {
  var buf = h$newByteArray(4);
  buf.arr = [v];
  h$ret1 = 0;
  return buf;
}

function h$hs_free_stable_ptr(stable) {

}

function h$malloc(n) {
  h$ret1 = 0;
  return h$newByteArray(n);
}

function h$free() {

}

function h$memset() {
  var buf_v, buf_off, chr, n;
  buf_v = arguments[0];
  if(arguments.length == 4) { // Addr#
    buf_off = arguments[1];
    chr     = arguments[2];
    n       = arguments[3];
  } else if(arguments.length == 3) { // ByteString#
    buf_off = 0;
    chr     = arguments[1];
    n       = arguments[2];
  } else {
    throw("h$memset: unexpected argument")
  }
  var end = buf_off + n;
  for(var i=buf_off;i<end;i++) {
    buf_v.u8[i] = chr;
  }
  ret1 = buf_off;
  return buf_v;
}

function h$memcmp(a_v, a_o, b_v, b_o, n) {
  for(var i=0;i<n;i++) {
    var a = a_v.u8[a_o+i];
    var b = b_v.u8[b_o+i];
    var c = a-b;
    if(c !== 0) { return c; }
  }
  return 0;
}

function h$memmove(a_v, a_o, b_v, b_o, n) {
  if(n > 0) {
    var tmp = new Uint8Array(b_v.buf.slice(b_o,b_o+n));
    for(var i=0;i<n;i++) {
      a_v.u8[a_o+i] = tmp[i];
    }
  }
  h$ret1 = a_o;
  return a_v;
}
function h$mkPtr(v, o) {
  return h$c2(h$baseZCGHCziPtrziPtr_con_e, v, o);
};
function h$mkFunctionPtr(f) {
  var d = h$newByteArray(4);
  d.arr = [f];
  return d;
}
h$freeHaskellFunctionPtr = function () {
}
function h$createAdjustor(cconv, hptr, hptr_2, wptr, wptr_2, type) {
    h$ret1 = hptr_2;
    return hptr;
};

function h$isInstanceOf(o,c) {
  return o instanceof c;
}