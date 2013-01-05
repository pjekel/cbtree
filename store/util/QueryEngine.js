//
// Copyright (c) 2012-2013, Peter Jekel
// All rights reserved.
//
//	The Checkbox Tree (cbtree) is released under to following three licenses:
//
//	1 - BSD 2-Clause								(http://thejekels.com/cbtree/LICENSE)
//	2 - The "New" BSD License				(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	3 - The Academic Free License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define(["../../util/shim/Array"], function() {
		"use strict";
	// module:
	//		cbtree/store/util/QueryEngine

	var moduleName = "cbtree/store/util/QueryEngine";

	function contains(/*any[]*/ values, /*any|any[]*/ match, /*Boolean?*/ ignoreCase) {
		// summary:
		//		Test if an array contains specific value(s) or if array values match
		//		regular expression(s).
		// values:
		//		Array of values to search.
		// match:
		//		A value or regular expression or an array of the previous types to match.
		//		If match is an array, all elements in the array must match.
		// ignoreCase:
		//		If set to true and the array values have a toLowerCase method a case
		//		insensitive match is performed.
		// returns:
		//		Boolean true or false
		// tag:
		//		Private
		if (match) {
			if (match.test) {
				return values.some( function (value) {
					return match.test(value);
				});
			}
			if (match instanceof Array) {
				return match.every( function (matchValue) {
					return contains(values, matchValue, ignoreCase);
				});
			}
			if (ignoreCase) {
				return values.some( function (value) {
					value = value.toLowerCase ? value.toLowerCase() : value;
					match = match.toLowerCase ? match.toLowerCase() : match;
					return (value == match);
				});
			}
			return (values.indexOf(match) != -1);
		}
		return false;
	}

	function match(/*any*/ valueA, /*any*/ valueB, /*Boolean?*/ ignoreCase ) {
		// summary:
		//		Test if two values match or, if valueA is an array, if valueA contains
		//		valueB.
		// valueA:
		//		Value or an array of values.
		// valueB:
		//		A value or regular expression or an array for the previous types.
		// ignoreCase:
		//		If true perform case insensitive value matching.
		// returns:
		//		True if there is a match or valueA contains valueB otherwise false.
		// tag:
		//		Private

		if (ignoreCase && valueB && !valueB.test) {
			valueB = valueB.toLowerCase ? valueB.toLowerCase() : valueB;
			valueA = valueA.toLowerCase ? valueA.toLowerCase() : valueA;
		}
		// First, start with a simple base type comparison
		if (valueB == valueA) {
			return true;
		}
		// Second, test for array instance. This must happen BEFORE executing any
		// regular expression because if 'valueB' is a regular expression we must
		// execute the expression on the array elements and not the array itself.
		if (valueA instanceof Array) {
			return contains(valueA, valueB, ignoreCase);
		}
		// Thrid, check if the object has a test method, which makes it also work
		// with regular expressions (RegExp).
		if (valueB && valueB.test) {
			return valueB.test(valueA);
		}
		return false;
	}

	var QueryEngine = function (/*Object|Function|String*/ query, /*Store.QueryOptions?*/options) {
		// summary:
		//		Query engine that matches using filter functions, named filter functions
		//		or a key:value pairs objects (hash).
		// query:
		//		- If query is a key:value pairs object, each	key:value pair is matched
		//		with	the corresponding key:value pair of	the store objects unless the
		//		query property value is a function in which case the function is called
		//		as: func(object,key,value).		Query property values can be a string, a
		//		number, a regular expression, an object providing a test() method or an
		//		array of any of the previous types or a function.
		//		- If query is a function, the fuction is called once for every store
		//		object as query(object). The query function must return boolean true
		//		or false.
		//		- If query is a string, the string value is the name of a store method.
		// options:
		//		Optional dojo/store/api/Store.QueryOptions object that contains optional
		//		information such as sort, start or count.	In addition to the standard
		//		QueryOptions properties, this query engine also support the ignoreCase
		//		property.
		// returns:
		//		A function with the property 'matches'. The 'matches' property equates
		//		to the actual query function.
		//
		// example:
		//		Define a store with a reference to this engine, and set up a query method.
		//
		//	| require([ ... ,
		//	|					"./util/QueryEngine",
		//	|					 ...
		//	|				 ], function( ... , QueryEngine, ... ) {
		//	|	 var myStore = function(options) {
		//	|		 //	...more properties here
		//	|		 this.queryEngine = QueryEngine;
		//	|		 //	define our query method
		//	|		 this.query = function(query, options) {
		//	|				return QueryResults(this.queryEngine(query, options)(this.data));
		//	|		 };
		//	|	 };
		//	|	 return myStore;
		//	| });

		var ignoreCase = options && !!options.ignoreCase;
		var queryFunc  = function () {};

		// create our matching query function
		switch (typeof query) {
			case "undefined":
			case "object":
				queryFunc = function (object) {
					var key, value, required;
					for(key in query) {
						required = query[key];
						value		= object[key];
						if (!match( value, required, ignoreCase )) {
							if (typeof required == "function") {
								if (required(value, key, object)) {
									continue;
								}
							}
							return false;
						}
					}
					return true;
				};
				break;
			case "string":
				// named query
				if (!this[query] || typeof this[query] != "function") {
					throw new Error("No filter function " + query + " was found in store");
				}
				queryFunc = this[query];
				break;
			case "function":
				queryFunc = query;
				break;
			default:
				throw new TypeError("Can not query with a " + typeof query);
		} /*end switch() */

		function execute(/*Object[]*/ objects, /*Boolean*/ noFilter) {
			// summary:
			//		Execute the query on	a set of objects and apply pagination	to the
			//		query result.	This function is returned as the result of a call to
			//		function QueryEngine(). The QueryEngine method provides the closure
			//		for this execute() function.
			// objects:
			//		The array of objects on which the query is performed.
			// noFilter:
			//		If true, only sort and pagination is applied to the set of objects.
			// returns:
			//		An array of objects matching the query.
			// tag:
			//		Private
			var sortSet  = options && options.sort;
			var results  = noFilter ? objects : objects.filter(queryFunc);
			var sortFunc = sortSet;

			if (sortSet) {
				if (typeof sortFunc != "function") {
					sortFunc = function (a, b) {
						var i, sort, valA, valB;

						for(i=0; sort = sortSet[i]; i++) {
							valA = a[sort.attribute];
							valB = b[sort.attribute];

							if (sort.ignoreCase) {
								valA = (valA && valA.toLowerCase) ? valA.toLowerCase() : valA;
								valB = (valB && valB.toLowerCase) ? valB.toLowerCase() : valB;
							}
							if (valA != valB) {
								return (!!sort.descending == (valA == null || valA > valB)) ? -1 : 1;
							}
						}
						return 0;
					}
				}
				results.sort( sortFunc );
			}
			// Paginate the query result
			if (options && (options.start || options.count)) {
				var total = results.length;
				results = results.slice(options.start || 0, (options.start || 0) + (options.count || Infinity));
				results.total = total;
			}
			return results;
		} /* end execute() */

		execute.matches = queryFunc;
		return execute;

	};	/* end QueryEngine */

	return QueryEngine;
});
