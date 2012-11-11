define(["dojo/_base/lang",
				"dojo/Deferred",
				"dojo/Evented",
				"dojo/when"
			 ], function (lang, Deferred, Evented, when) {

	var EventedStore = function (/*dojo.store*/ store) {
		// summary:

		var orgMethods = {};
		var mutex      = null;

		// Create a new store instance, mixin the 'on' and 'emit' methods and mark
		// the object store as being an 'evented' store. This module is intended to
		// be used with stores which implement the dojo/store/api

		store = lang.delegate(store, new Evented());
		store.isEvented = true;

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

		function lock( action ) {
			// summary:
			//		Aquire a mutex and call the action routine. Asynchronous transactional
			//		stores may process read and write transactions out of order and not in
			//		sequence of their creation. Aquiring a mutex will guarantee that a set
			//		of store operations are handled as an intrinsic set.
			// action:
			//		Function called when the mutex is aquired. On completion the method MUST
			//		release the mutex by calling unlock().
			// tag:
			//		Private
			when( mutex, function () {
				mutex = new Deferred();
				try {
					action();
				} catch(err) {
					unlock();
					throw err;
				}
			});
		}

		function unlock() {
			// summary:
			//		Release mutex
			mutex.resolve();
		}

		addAdvice( "add", function(object, options) {
			var result = orgMethods["add"].apply(store, arguments);
			when( result, function(id) {
				if (id) {
					store.emit("onNew", {type:"new", item: object});
				}
			});
		});

		addAdvice( "put", function(object, options) {
			var args = arguments;
			lock( function() {
				when( store.get( store.getIdentity(object) ), function (storeItem) {
					var orgItem = storeItem ? lang.mixin({}, storeItem) : null;
					var result  = orgMethods["put"].apply(store, args);
					when( result, function(id) {
						unlock();
						if (id) {
							if (orgItem) {
								store.emit("onChange", {type:"update", item: object, oldItem: orgItem});
							} else {
								store.emit("onNew", {type:"new", item: object});
							}
						}
					}, unlock);
				}, unlock);
			});
		});

		addAdvice( "remove", function(id, options) {
			var args = arguments;
			lock( function() {
				when( store.get(id), function (storeItem) {
					var orgItem = storeItem ? lang.mixin({}, storeItem) : null;
					var result  = orgMethods["remove"].apply(store, args);
					when( result, function() {
						unlock();
						if (orgItem) {
							store.emit("onDelete", {type:"delete", item: orgItem});
						}
					});
				}, unlock );
			});
		});

		return store;

	};
	return EventedStore;
});
