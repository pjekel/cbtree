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
define(["dojo/_base/declare",
				"dojo/store/util/QueryResults",
				"./Hierarchy",
				"../Evented"
			 ], function (declare, QueryResults, Hierarchy, Evented) {
	"use strict";

	// module:
	//		cbtree/store/ObjectStore
	// summary:
	//		This store implements the cbtree/store/api/Store API which is an extension
	//		to the dojo/store/api/Store API.

	var moduleName = "cbTree/store/ObjectStore";

	var ObjectStore = declare([Hierarchy, Evented], {
		// summary:
		//		This in-memory store implements the full cbtree/store/api/Store API.
		//		The store combines the functionality of the cbtree/store/Hierarchy
		//		store with the event capabilities of the cbtree/store/Eventable store
		//		wrapper without the extra overhead of having to warp a store. From
		//		a functional stand point the following two examples are the same:
		//
		//			myStore = Eventable( new Hierary( ... ) );
		//			myStore = new ObjectStore( ... );
		//
		//		This store type is the preferred store when multiple models operate
		//		on a single store.

		// eventable: Boolean [read-only]
		//		Indicates this store emits events when the content of the store changes.
		//		This type of store is referred to as an "Eventable" store.
		eventable: true,

		//=========================================================================
		// Public dojo/store/api/store API methods

		add: function (/*Object*/ object,/*PutDirectives?*/ options) {
			// summary:
			//		Creates an object, throws an error if the object already exists
			// object:
			//		The object to store.
			// options:
			//		Additional metadata for storing the data.	Includes an "id"
			//		property if a specific id is to be used.
			// returns:
			//		String or Number
			// tag:
			//		Public
			var id = this._getObjectId(object, options);
			var at = this._indexId[id];

			if (at >= 0) {
				throw new Error("Object already exists");
			}
			id = this._writeObject(id, object, at, options);
			this.emit("new", {type:"new", item: object});
			return id;
		},

		put: function (/*Object*/ object,/*PutDirectives?*/ options) {
			// summary:
			//		Stores an object
			// object:
			//		The object to store.
			// options:
			//		Additional metadata for storing the data.
			// returns:
			//		String or Number
			// tag:
			//		Public
			var id = this._getObjectId(object, options);
			var at = this._indexId[id];

			var orgObj, exist = false;

			if (at >= 0) {
				if (options && options.overwrite === false) {
					throw new Error("Object already exists");
				}
				orgObj = this._data[at];
				exist	= true;
			}
			id = this._writeObject(id, object, at, options);
			if (exist) {
				this.emit("change", {type:"change", item: object, oldItem: orgObj});
			} else {
				this.emit("new", {type:"new", item: object});
			}
			return id;
		},

		remove: function (/*String|Number*/ id) {
			// summary:
			//		Deletes an object by its identity
			// id:
			//		The identity to use to delete the object
			// returns:
			//		Returns true if an object was removed otherwise false.
			var at = this._indexId[id];
			if (at >= 0) {
				var object = this._data[at];
				object[this.parentProperty] = undef;
				this._updateHierarchy(object);
				this._data.splice(at, 1);
				// now we have to reindex
				this._indexData();
				this.emit("delete", {type:"delete", item: object});
				return true;
			}
			return false;
		}

	});	/* end declare() */

	return ObjectStore

});	/*end define() */
