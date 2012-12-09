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
				"./Memory",
				"../shim/Array"                 // ECMA-262 Array shim
			 ], function (declare, Memory) {

// module:
//		cbtree/stores/ObjectStore

	var moduleName = "cbTree/store/Hierarchy";
	var undef;

	var Hierarchy = declare([Memory], {
		// summary:
		//		The Hierarchy Store provide support for the dojo/store PutDirectives
		//		properties 'before' and 'parent'. Objects loaded into the store will
		//		automatically get a "parent" property if they don't have one already.
		//		The object's parent property value is the identifier of the object's
		//		parent. (see also: multiParented).
		//
		// 		For addional information see dojo/store/api/Store.PutDirectives

		//=========================================================================
		// Additional constructor keyword arguments:

		// multiParented: Boolean|String
		//		Indicates if the store is to support multi-parented objects. If true
		//		the parent property of store objects is stored as an array. If "auto"
		//		multi-parenting will be determined by the data loaded into the store.
		//		Also, the cbtree Models tests for the presence of this property in
		//		order to determine if it has to set the parent property of an object
		//		or if the store will handle it.
		multiParented: "auto",

		// parentProperty: String
		// 		The property name of an object whose value represents the object's
		//		parent id(s).
		parentProperty: "parent",

		//=========================================================================
		// Private methods

		_getParentId: function (/*Object*/ object,/*String|Number*/ objectId,/*Object[]*/ parents) {
			// summary:
			//		Get the parent property of a store object.
			// object:
			//		The object to store.
			// objectId:
			//		The object identification.
			// parents:
			//		The parent(s) of the object. The parents arguments can be a single
			//		id or an array of id's.
			// returns:
			//		Array of parent Ids.
			// tag:
			//		Private
			var i, parentId, np;

			if (parents instanceof Array) {
				for (i=0; i<parents.length; i++) {
					if (parentId = this.getIdentity(parents[i])) {
						if (parentId != objectId && np.indexOf(parentId) == -1) {
							np ? np.push(parentId) : np = [parentId];
						}
					}
				}
			} else {
				if (parentId = this.getIdentity(parents)) {
					if (parentId != objectId) {
						np = parentId;
					}
				}
			}
			return np;
		},

		_setParentType: function (/*id|id[]*/ parents) {
			// summary:
			//		Convert the parent(s) from a single value to an array or vice versa
			//		depending on the stores multiParented property value.
			// parents:
			//		Parent Id or an array of parent ids.
			// tag:
			//		Private
			if (this.multiParented === true) {
				if (!(parents instanceof Array)) {
					parents = (parents != undef) ? [parents] : [];
				}
			} else if (this.multiParented === false) {
				if (parents instanceof Array) {
					parents = (parents.length ? parents[0] : undef);
				}
			} else if (this.multiParented === "auto") {
				this.multiParented = (parents instanceof Array);
			}
			return parents;
		},

		_writeObject: function (/*Object*/ object,/*Number*/ index,/*Store.PutDirectives*/ options) {
			// summary:
			//		Store an object.
			// object:
			//		The object to store.
			// index:
			//		Index number of the object in the stores data array. If specified it
			//		indicates an existing object in the store otherwise it's a new store
			//		object.
			// options:
			//		Additional metadata for storing the data.
			// returns:
			//		The object ID
			// tag:
			//		Private
			var id = object[this.idProperty];

			if (options && "parent" in options) {
				object[this.parentProperty] = this._getParentId(object, id, options.parent);
			}
			// Convert the 'parent' property to the correct format.
			object[this.parentProperty] = this._setParentType(object[this.parentProperty]);

			if (options && options.before) {
				var beforeAt, beforeId;
				if (beforeId = this.getIdentity(options.before)) {
					beforeAt = this._index[beforeId];
					if (beforeAt != undef) {
						if (index) {
							if (index != beforeAt) {
								beforeAt = (beforeAt > index ? beforeAt - 1 : beforeAt);
								this._data.splice(index,1);
							} else {
								this._data[index] = object;
								return id;
							}
						}
						// Insert the object and re-index the store.
						this._data.splice( beforeAt, 0, object);
						this._indexData();
						return id;
					}
				}
			}
			return this.inherited(arguments);
		},

		//=========================================================================
		// Public dojo/store/api/store API methods

		getChildren: function (/*Object*/ parent, /*Store.QueryOptions?*/ options) {
			// summary:
			//		Retrieves the children of an object.
			// parent:
			//		The object to find the children of.
			// options:
			//		Additional options to apply to the retrieval of the children.
			// returns:
			//		dojo/store/api/Store.QueryResults: A result set of the children of
			//		the parent object.
			// tag:
			//		Public
			var query = {};

			query[this.parentProperty] = this.getIdentity(parent);
			return this.query( query, options );
		},

		//=========================================================================
		// Public dojo/store/api/store API extensions

		getParents: function (/*Object*/ child) {
			// summary:
			//		Retrieve the parent(s) of an object
			// child:
			// returns:
			//		An array of objects
			// tag:
			//		Public
			var parentIds = child[this.parentProperty] || [];
			var parents   = [];

			parentIds = parentIds instanceof Array ? parentIds : [parentIds];
			parentsIds.forEach( function (parentId) {
				var parent = this.get(parentId);
				if (parent) {
					parents.push(parent);
				}
			}, this);
			return parents;
		}

	});	/* end declare() */

	return Hierarchy

});
