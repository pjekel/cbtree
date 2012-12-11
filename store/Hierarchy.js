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
	//		cbtree/store/Hierarchy
	// summary:
	//		This store implements the cbtree/store/api/Store API which is an extension
	//		to the dojo/store/api/Store API.

	var moduleName = "cbTree/store/Hierarchy";
	var undef;

	var Hierarchy = declare([Memory], {
		// summary:
		//		This in-memory store implements the full cbtree/store/api/Store API.
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

		_getParentArray: function (/*Object*/ object) {
			// summary:
			//		Return the parents of an object as an array of identifiers.
			// object: Object
			//		Store object
			// returns:
			//		An array of parent Ids.
			// tag:
			//		Private
			var parentIds = object[this.parentProperty] || [];
			return (parentIds instanceof Array ? parentIds : [parentIds]);
		},

		_getParentIds: function (/*String|Number*/ objectId,/*any*/ parents) {
			// summary:
			//		Extract the parent ids from a list of parents.
			// objectId:
			//		The object identification.
			// parents:
			//		The parent(s) of an object. The parents arguments can be an id,
			//		an object or an array of those types.
			// returns:
			//		An array of parent Ids.
			// tag:
			//		Private
			var parentIds = [];

			parents = (parents instanceof Array ? parents : (parents ? [parents] : []));
			parents.forEach( function (parent) {
				switch (typeof parent) {
					case "object":
						parent = this.getIdentity(parent);
						/* NO BREAK HERE */
					case "string":
					case "number":
						if (parent) {
							// Make sure we don't parent ourself.....
							if (parent != objectId && parentIds.indexOf(parent) == -1) {
								parentIds.push(parent);
							}
						}
						break;
					default:
						throw new TypeError( moduleName+"::_getParentId(): Invalid identifier type");
				}
			}, this);
			return parentIds;
		},

		_setParentType: function (/*id|id[]*/ parentId) {
			// summary:
			//		Convert the parent(s) from a single value to an array or vice versa
			//		depending on the store multiParented property value.
			// parentId:
			//		Parent Id or an array of parent ids.
			// tag:
			//		Private
			if (this.multiParented === true) {
				if (!(parentId instanceof Array)) {
					parentId = (parentId ? [parentId] : []);
				}
			} else if (this.multiParented === false) {
				if (parentId instanceof Array) {
					parentId = (parentId.length ? parentId[0] : undef);
				}
			} else if (this.multiParented === "auto") {
				this.multiParented = (parentId instanceof Array);
			}
			return parentId;
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
				object[this.parentProperty] = this._getParentIds(id, options.parent);
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
		// Public cbtree/store/api/store API methods

		addParent: function(/*Object*/ child,/*any*/ parents) {
			// summary:
			//		Add parent(s) to the list of parents of child.
			// parents: any
			//		Id or Object or an array of those types to be added as the parent(s)
			//		of child.
			// child: Object
			//		Store object to which the parent(s) are added
			// returns: Boolean
			//		true if parent id was successfully added otherwise false.
			var childId  = this.getIdentity(child);
			var childObj = this.get(childId);

			if (childObj) {
				var newIds = this._getParentIds(childId, parents);
				if (newIds.length) {
					var currIds = this._getParentArray(childObj);
					newIds.forEach( function (id) {
						if (currIds.indexOf(id) == -1) {
							currIds.unshift(id);
						}
					});
					childObj[this.parentProperty] = this._setParentType(currIds);
					this.put(childObj);
					return true;
				}
				return false;
			} else {
				throw new TypeError(moduleName+"::addParent(): child is not a store object");
			}
		},

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

		getParents: function (/*Object*/ child) {
			// summary:
			//		Retrieve the parent(s) of an object
			// child:
			// returns:
			//		An array of objects
			// tag:
			//		Public
			var parentIds = this._getParentArray(child);
			var parents   = [];

			parentsIds.forEach( function (parentId) {
				var parent = this.get(parentId);
				if (parent) {
					parents.push(parent);
				}
			}, this);
			return parents;
		},

		removeParent: function(/*Object*/ child,/*any*/ parents) {
			// summary:
			//		Remove a parent from the list of parents of child.
			// parents: any
			//		Id or Object or an array of the those types to be removed from the
			//		list of parent(s) of child.
			// child:
			//		Store object from which the parent(s) are removed
			// returns: Boolean
			//		true if the parent id was successfully removed otherwise false.
			var childId  = this.getIdentity(child);
			var childObj = this.get(childId);

			if (childObj) {
				var remIds = this._getParentIds(childId, parents);
				if (remIds.length) {
					var currIds = this._getParentArray(childObj);
					currIds = currIds.filter( function (id) {
						return (remIds.indexOf(id) == -1);
					});
					childObj[this.parentProperty] = this._setParentType(currIds);
					this.put(childObj);
					return true;
				}
				return false;
			} else {
				throw new TypeError(moduleName+"::addParent(): child is not a store object");
			}
		}

	});	/* end declare() */

	return Hierarchy

});
