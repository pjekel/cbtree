define (["./_Path"], function (Path) {
	"use strict";

	var defineProperty = Object.defineProperty || function (obj, property, options) {
		if (obj[property] == undefined) {
			obj[property] = options.value;
		}
	};

	function argsToPaths() {
		// summary:
		//		Convert the arguments list into an array of Paths.
		// tag:
		//		Private
		var args  = Array.prototype.slice.call(arguments);
		var items = [];

		args.forEach( function( argument ) {
			if (typeof argument === "string" || argument instanceof String) {
				items.push( new Path(argument) );
			} else if (argument instanceof Path) {
				items.push(argument);
			} else if (argument instanceof Array) {
				items = items.concat( argsToPaths.apply( this, argument ));
			} else if (argument instanceof PathList) {
				items = items.concat( argsToPaths.apply( this, Array.prototype.slice.call(argument) ));
			} else {
				throw TypeError("Invalid argument type");
			}
		});
		return items;
	}

	function intersect ( pathsA, pathsB, inclusive, same ) {
		var res = [];
		
		pathsA.forEach (function (pathA) {
			if (same) { pathsB.shift(); };
			
			pathsB.forEach( function (pathB) {
				pathA.intersect(pathB, inclusive).forEach( function (segment) {
					if (res.indexOf(segment) == -1) {
						res.push(segment);
					}
				});
			});
		});
		return res;
	}


	function PathList () {

		this.contains = function (segment) {
			if (this !=  null && segment) {
				return this.some( function (path) {
					if (path.contains( segment )) {
						return true;
					}
				});
			}
			throw new TypeError();
		};

		this.intersect = function (paths, inclusive) {
			if (this != null) {
				var pathList, sameList = false;
				if (arguments.length) {
					if (typeof paths == "boolean") {
						inclusive = !!arguments[0];
					} else {
						pathList = argsToPaths(paths);
					}
				}
				if (!pathList) {
					pathList = Array.prototype.slice.call(this, 0);
					sameList  = true;
				}
				return intersect( this, pathList, inclusive, sameList );
			}
			throw new TypeError();
		};
		
		this.segments = function () {
			if (this != null) {
				var res = [];
				this.forEach( function (path) {
					path.segments().forEach( function (segment) {
						if (res.indexOf(segment) == -1) {
							res.push(segment);
						}
					});
				});
				return res;
			}
			throw new TypeError();
		};

		//===
		// Array style methods.

		this.push = function () {
			if (arguments.length > 0) {
				var paths = argsToPaths.apply(this, arguments );
				if (paths.length > 0) {
					paths.forEach( function( item, idx ) {
						Object.defineProperty( this, this.length+idx, {	value: item, enumerable: true, writable: false	});
						this.length++;
					}, this);
				}
			}
		};

		this.filter = function ( callback, thisArg ) {
			if (this !=  null && typeof callback == "function") {
				var res = new PathList();
				var obj = Object(this);
				var idx, val;

				for (idx=0; idx < obj.length; idx++) {
					if (idx in obj) {
						val = obj[idx];
						if (callback.call( thisArg, val, idx, obj)) {
							res.add( val );
						}
					}
				}
				return res;
			}
			throw new TypeError();
		};

		this.forEach = function ( callback , thisArg ) {
			if (this !=  null && typeof callback == "function") {
				var obj = Object(this);
				var idx = 0;

				for (idx=0; idx < obj.length; idx++) {
					if (idx in obj) {
						callback.call( thisArg, obj[idx], idx, obj );
					}
				}
			} else {
				throw new TypeError();
			}
		}

		this.some = function ( callback, thisArg ) {
			if (this !=  null && typeof callback == "function") {
				var obj = Object(this);
				var idx = 0;

				for (idx=0; idx < obj.length; idx++) {
					if (idx in obj) {
						if (callback.call( thisArg, obj[idx], idx, obj)) {
							return true;
						}
					}
				}
				return false;
			}
			throw new TypeError();
		};

		defineProperty( this, "length", { writable: true,  enumerable: false	});
		defineProperty( this, "filter", { writable: false, enumerable: false	});
		defineProperty( this, "forEach",{ writable: false, enumerable: false	});
		defineProperty( this, "some",   { writable: false, enumerable: false	});
		defineProperty( this, "push",   { writable: false, enumerable: false	});

		this.length = 0;
		
		this.push.apply(this, arguments);
	}

	return PathList;
	
});
