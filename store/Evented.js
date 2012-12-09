//
// Copyright (c) 2010-2013, Peter Jekel
// All rights reserved.
//
//	The Checkbox Tree (cbtree), also known as the 'Dijit Tree with Multi State Checkboxes'
//	is released under to following three licenses:
//
//	1 - BSD 2-Clause							 (http://thejekels.com/cbtree/LICENSE)
//	2 - The "New" BSD License			 (http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	3 - The Academic Free License	 (http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//
//	In case of doubt, the BSD 2-Clause license takes precedence.
//
define(["dojo/_base/lang",
				"dojo/Deferred",
				"dojo/Evented",
				"dojo/when",
				"./util/Mutex"
			 ], function (lang, Deferred, Evented, when, Mutex) {

	var EventedStore = function (/*dojo.store*/ store) {
		// summary:
		//		The Evented store wrapper takes a store and adds advice like methods to
		//		the stores add, put and remove methods. As a result, any store add, put
		//		or remove operations will generate an event the user application can
		//		subscribe to using dojo/on. Each event has at least the following two
		//		properties:
		//
		//		type: String
		//			"delete" | "new" | "update"
		//		item:
		//			Store object.
		//
		// example:
		//		Create a Memory store that generate events when the content of the store
		//		changes.
		//
		//	|	var store = Evented( new Memory( {
		//	|		data: [
		//	|			{id: 1, name: "one", prime: false},
		//	|			{id: 2, name: "two", even: true, prime: true},
		//	|			{id: 3, name: "three", prime: true},
		//	|			{id: 4, name: "four", even: true, prime: false},
		//	|			{id: 5, name: "five", prime: true}
		//	|		]
		//	|	}));
		//	|
		//	| function modified( event ) {
		//	|		var id = store.getIdentity( event.item );
		//	|		console.log( "Item: "+id+" was modified.");
		//	|	}
		//	|
		//	|	on( store, "change", lang.hitch( this, modified) );

		var orgMethods = {};
		var mutex      = new Mutex();

		// Create a new store instance, mixin the 'on' and 'emit' methods and mark
		// the object store as being an 'evented' store. This module is intended to
		// be used with stores that implement the dojo/store/Store API

		store = lang.delegate(store, new Evented());
		store.evented = true;

		function addAdvice(/*String*/ method, /*Function*/ action ) {
			// summary:
			//		Add 'around' advice to a store method. Because of the dojo/advice
			//		calling conventions we can't use it here, this method provides a
			//		different way of wrapping the store methods.
			// method:
			//		Store method the be replaced.
			// action:
			//		Replacement method.
			// tag:
			//		Private
			if (store[method] && typeof store[method] === "function") {
				orgMethods[method] = store[method];
				store[method] = action;
			}
		}

		addAdvice( "add", function (object, options) {
			var result = orgMethods["add"].apply(store, arguments);
			when( result, function(id) {
				if (id) {
					store.emit("new", {type:"new", item: object});
				}
			});
			return result;
		});

		addAdvice( "put", function (object, options) {
			var args = arguments;
			return mutex.aquire( function() {
				when( store.get( store.getIdentity(object) ),
					function (storeItem) {
						var orgItem = lang.mixin({}, storeItem);
						var result  = orgMethods["put"].apply(store, args);
						when( result, function(id) {
							mutex.release(id);
							if (storeItem) {
								store.emit("change", {type:"change", item: object, oldItem: orgItem});
							} else {
								store.emit("new", {type:"new", item: object});
							}
						}, mutex.onError);
					},
					function (err) {
						var result  = orgMethods["put"].apply(store, args);
						when( result, function(id) {
							mutex.release(id);
							store.emit("new", {type:"new", item: object});
						}, mutex.onError);
					}
				);
			});
		});

		addAdvice( "remove", function (id, options) {
			var args = arguments;
			return mutex.aquire( function() {
				when( store.get(id), function (storeItem) {
					var orgItem = storeItem ? lang.mixin({}, storeItem) : null;
					var result  = orgMethods["remove"].apply(store, args);
					when( result, function(removed) {
						mutex.release(removed);
						if (orgItem) {
							store.emit("delete", {type:"delete", item: orgItem});
						}
					});
				}, mutex.onError );
			});
		});

		return store;

	};
	return EventedStore;
});
