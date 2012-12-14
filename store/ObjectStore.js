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
define(["dojo/_base/declare",
				"dojo/Evented",
				"./Hierarchy"
			 ], function (declare, Evented, Hierarchy) {
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
		//		store with the event capabilities of the cbtree/store/Evented store
		//		wrapper without the extra overhead of having to warp a store. From
		//		a functional stand point the following two examples are the same:
		//
		//			myStore = Evented( new Hierary( ... ) );
		//			myStore = new ObjectStore( ... );
		//

		// evented: Boolean
		//		Indicates this is an "evented" store.
		evented: true,

		//=========================================================================
		// Constructor

		constructor: function () {
			this.evented = true;		// Force evented to be true...
		},

		//=========================================================================
		// Public dojo/store/api/store API methods

		add: function (/*Object*/ object,/*PutDirectives?*/ options) {
			// summary:
			//		Creates an object, throws an error if the object already exists
			// object:
			//		The object to store.
			// options:
			//		Additional metadata for storing the data.  Includes an "id"
			//		property if a specific id is to be used.
			// returns:
			//		String or Number
			// tag:
			//		Public
			var id = this._setObjectId(object, options);
			var at = this._index[id];

			if (at >= 0) {
				throw new Error("Object already exists");
			}
			id = this._writeObject(object, at, options);
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
			var id = this._setObjectId(object, options);
			var at = this._index[id];

			var orgObj, exist = false;

			if (at >= 0) {
				if (options && options.overwrite === false) {
					throw new Error("Object already exists");
				}
				orgObj = this._data[at];
				exist  = true;
			}
			id = this._writeObject(object, at, options);
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
			var at = this._index[id];
			if (at >= 0) {
				var object = this._data[at];
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

});
