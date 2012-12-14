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
define(["dojo/_base/declare", 	// declare
				"dojo/when",						// when()
				"./TreeStoreModel",
				"./_Parents",
				"../shim/Array"					// ECMA-262 Array shim
			 ], function (declare, when, TreeStoreModel, Parents){
	"use strict";

		// module:
		//		cbtree/model/FileStoreModel
		// summary:
		//		Implements cbtree/model/Model API connecting to a dojo/store.  This model
		//		can be used with an observable, non-observable or evented FileStore.
		//		(See cbtree/store/FileStore)

	var moduleName = "cbTree/model/FileStoreModel";

	return declare([TreeStoreModel], {

		constructor: function(/* Object */ kwArgs){
			// summary:
			// tags:
			//		private

			var store = this.store;
			var model = this;

			if (store) {
				if (store.defaultProperties && typeof store.defaultProperties === "object") {
					store.defaultProperties[this.checkedAttr] = this.checkedState;
				}
			}
		},

		mayHaveChildren: function(/*Object*/ item){
			// summary:
			//		Tells if an item has or may have children. Implementing logic here
			//		avoids showing +/- expando icon for nodes that we know don't have
			//		children.
			// item:
			//		Object.
			// tags:
			//		public

			return item && !!item.directory;
		},

		newItem: function(/*dijit/tree/dndSource.__Item*/ args, /*Item*/ parent, /*int?*/ insertIndex, /*Item*/ before){
			// summary:
			// tag:
			//		Private
			throw new Error(moduleName+"::newItem(): Operation not allowed on a FileObjectStore.");
		},

		pasteItem: function(/*Item*/ childItem, /*Item*/ oldParentItem, /*Item*/ newParentItem) {
			// summary:
			//		Move or copy an item from one parent item to another.
			//		Used in drag & drop

			if (newParentItem.directory && (newParentItem.path != oldParentItem.path)) {
				var parentIds   = new Parents( childItem, this.parentAttr );
				var oldParentId = this.getIdentity(oldParentItem);
				var self        = this;

				var newPath = newParentItem.path + "/" + childItem.name;
				when (this.store.rename(childItem, newPath), function () {
					if (!self.store.evented) {
						self._childrenChanged( [oldParentItem, newParentItem] );
					}
				});
			}
		},

		// =======================================================================
		// Internal event listeners.

		_onDeleteItem: function (/*Object*/ item) {
			// summary:
			//		Handler for delete notifications from the store.
			// item:
			//		The store item that was deleted.
			// tag:
			//		Private
			var id   = this.getIdentity(item);
			var self = this;

			// Because observable does not provide definitive information if the item
			// was actually deleted or just moved (re-parented) we need to check the
			// store and see if the item still exist.
			when(this.store.get(id, true),
				function(exists) {
					if (!exists) {
						delete self._objectCache[id];
					}
				},
				function(err) {
					delete self._objectCache[id];
				}
			);
			self._deleteCacheEntry(id);
			self.onDelete(item);

			this.getParents(item).then( function (parents) {
				self._childrenChanged( parents );
			});
		}

	});
});
