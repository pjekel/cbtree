//
// Copyright (c) 2010-2012, Peter Jekel
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
				"dojo/_base/lang",			// lang.hitch()
				"dojo/aspect",					// aspect.before()
				"dojo/Deferred",
				"dojo/has",							// has.add()
				"dojo/on",              // on()
				"dojo/promise/all",
				"dojo/promise/Promise",	// instanceof
				"dojo/Stateful",				// get() and set()
				"dojo/when",						// when()
				"./_Parents",
				"../shim/Array"					// ECMA-262 Array shim
			 ], function (declare, lang, aspect, Deferred, has, on, all, Promise, Stateful, when, Parents){
	"use strict";
		// module:
		//		cbtree/models/ObjectStoreModel
		// summary:
		//		Implements cbtree/models/model API connecting to a dojo/store.  This model
		//		can be used with observable, non-observable, evented and basic dojo/store
		//		stores. Both synchronous and asynchronous store implementations are supported.
		//
		//		Store Types:
		//
		//		-	An observable store monitors the results of previously executed queries.
		//			Any changes to the store that effect the outcome of those queries result
		//			in an automatic update of the query results and a call to the observers
		//			callback function.
		//
		//		- An evented store will dispatch an event whenever a store item is added,
		//			deleted or updated. The events are NOT associated with any query.
		//
		//		Which store to use:
		//
		//			myStore = Observable( new Memory( ...) );
		//
		//		Although an observable store may seem the most obvious choice there is a
		//		significant overhead associated with this type of store simply because it
		//		keeps track of all previous executed store queries.  Fetching children of
		//		any tree nodes results in the creation of such query. Therefore, on large
		//		datasets (large trees) you can end up with hundreds of queries and as a
		//		result each change to the store will result in running all those queries
		//		against the newly added, deleted or changed store item.
		//
		//			myStore = Evented( new Memory( ... ) );
		//
		//		An evented store dispatches an event each time the store changes, that is,
		//		an item is added, deleted or changed. It merely notifies the model of the
		//		type of store operation performed and does NOT run potentially hundreds or
		//		even thousands of queries each time the store changes.
		//
		//			myStore = new Memory( ... )
		//
		//		The basic dojo/store, please note that Memory is just one implementation of
		//		the dojo/store API. Any store that complies with the dojo/store API can be
		//		used with this model. In case of direct use of a store, that is, not evented
		//		or observable the model will automatically generate the required events for
		//		the tree. However, any changes to the store outside the scope of the model
		//		will NOT be captured. For example, if you application modifies the store in
		//		any way of fashion by performing direct operations on it like store.put() or
		//		store.remove() than those changes will NOT be reflected in the tree and the
		//		internal cache will be out of sync. If however, you have static store content
		//		and nothing else is ooperating on the store then the basic store offers the
		//		best performance and least amount of overhead.

	function copyObject( obj ) {
		// summary:
		//		Lean & mean shallow copy machine
		var key, newObject = {};
		for (key in obj) {
			newObject[key] = obj[key];
		}
		return newObject;
	}

	return declare([Stateful], {

		//==============================
		// Keyword arguments (kwArgs) to constructor

		// checkedAll: Boolean
		//		If true, every store item will receive a 'checked' state property regard-
		//		less if the 'checked' attribute is specified in the dojo.store
		checkedAll: true,

		// checkedState: Boolean
		//		The default state applied to every store item unless otherwise specified
		//		in the dojo.store (see also: checkedAttr)
		checkedState: false,

		// checkedRoot: Boolean
		//		If true, the root node will receive a checked state. This attribute is
		//		independent of  the showRoot attribute of the tree itself. If the tree
		//		attribute showRoot is set to false the checked state for the root will
		//		not show either.
		checkedRoot: false,

		// checkedStrict: Boolean
		//		If true, a strict parent-child relation is maintained.   For example,
		//		if all children are checked the parent will automatically recieve the
		//		same checked state or if any of the children are unchecked the parent
		//		will, depending if multi state is enabled, recieve either a mixed or
		//		unchecked state.
		checkedStrict: true,

		// checkedAttr: String
		//		The attribute name (property of the store item) that holds the 'checked'
		//		state. On load it specifies the store items initial checked state.	 For
		//		example: { name:'Egypt', type:'country', checked: true } If a store item
		//		has no 'checked' attribute specified it will depend on the model property
		//		'checkedAll' if one will be created automatically and if so, its initial
		//		state will be set as specified by 'checkedState'.
		checkedAttr: "checked",

		// enabledAttr: String
		//		The attribute name (property of the store item) that holds the 'enabled'
		//		state of the checkbox or alternative widget.
		//		Note: Eventhough it is referred to as the 'enabled' state the tree will
		//		only use this property to enable/disable the 'ReadOnly' property of a
		//		checkbox. This because disabling a widget may exclude it from HTTP POST
		//		operations.
		enabledAttr:"",

		// iconAttr: String
		//		If specified, get the icon from an item using this attribute name.
		iconAttr: "",

		// labelAttr: String
		//		If specified, get label for tree node from this attribute.
		labelAttr: "name",

		// multiState: Boolean
		//		Determines if the checked state needs to be maintained as multi state or
		//		or as a dual state. ({"mixed",true,false} vs {true,false}).
		multiState: true,

		// normalize: Boolean
		//		When true, the checked state of any non branch checkbox is normalized, that
		//		is, true or false. When normalization is enabled checkboxes associated with
		//		tree leafs can never have a mixed state.
		normalize: true,

		// parentAttr: String
		//		The property name of a store item identifying its parent ID(s). The default
		//		dojo/store requires the property name to be 'parent'.
		parentAttr: "parent",

		// query: String
		//		Specifies the set of children of the root item.
		// example:
		//		{type:'continent'}
		query: null,

		// rootLabel: String
		//		Alternative label of the root item
		rootLabel: null,

		// store: dojo.store
		//		Underlying store
		store: null,

		storeLoader: null,

		// End Parameters to constructor
		//==============================

		moduleName: "cbTree/models/ObjectStoreModel",

		 // root: [readonly] Object
		//		Pointer to the root item (read only, not a parameter)
		root: null,

		// _validateStore: Boolean
		_validateStore: true,

		// _validating: [private] Number
		//		If not equal to zero it indicates store validation is on going.
		_validating: 0,

		constructor: function(/* Object */ kwArgs){
			// summary:
			//		Passed the arguments listed above (store, etc)
			// tags:
			//		private

			this.childrenCache = {};	// map from id to array of children
			this._objectCache  = {};
			this._storeLoaded  = new Deferred();

			declare.safeMixin(this, kwArgs);

			var store = this.store;

			if (store) {
				has.add("tree-model-getChecked", 1);
				if (store.put && typeof store.put === "function") {
					has.add("tree-model-setChecked", 1);
					this._writeEnabled = true;
				} else {
					console.warn(this.moduleName+"::constructor(): store is not write enabled.");
					this._writeEnabled = false;
				}

				// If the store doesn't have a loadStore() method, like the native dojo/store
				// Memory store, we assume the data is already loaded and available otherwise
				// the model will call the store loader. ( See validateData() )

				if (!this.storeLoader || typeof this.storeLoader != "function") {
					if (store.loadStore && typeof store.loadStore === "function") {
						this.storeLoader = store.loadStore;
					} else {
						this.storeLoader = function () {};
					}
				}

				//	Extend the store to provide support for getChildren() and Drag-n-Drop.
				//	For DnD to work correctly there are two requirements that must be met:
				//
				//		1 - The ID of a parent object, if specified, must be set as the
				//				parent property of the store object.
				// 		2 - To determine if an item dropped on the tree is under control
				//				of this model/store or comes from an external source, a store
				//				reference is added to the object. This new store property is
				//				used by the isItem() method.
				//
				if (!store.getChildren) {
					var funcBody = "return this.query({"+this.parentAttr+": this.getIdentity(object)});"
					store.getChildren = new Function("object", funcBody);
				}

				// Stick a magic marker on the store if it doesn't have one...
				if (!store.magic) {
					store.__magic = (Math.random() * 10000000) >>> 0;		// make it a UINT32
				}

				// Test if this store is 'evented', 'observable' or standard. If it is
				// evented register the event listeners.
				this._monitored = true;
				if (store.isEvented) {
					on( store, "onChange, onDelete, onNew", lang.hitch(this, "_onStoreEvent"));
				} else {
					// If this is a default dojo/store (not observable and not evented) we
					// will have to fire some of the events ourselves.
					if (!store.notify || !(typeof store.notify === "function")) {
						this._monitored = false;
					}
				}
				if (this._writeEnabled) {
					// Provide support for single and multi parented objects. (Note, the store
					// method getIdentity() is used to establish the parent id instead of simply
					// relying on the presence of an 'id' property, this because more complex
					// stores may actually use a key path. (see indexedStore).
					//
					// Note:	The prologue method only takes effect after the store has been
					//				created, any existing data in the store is not auto converted.

					var prologue = function _prologue (/*Object*/ obj, /*Object*/ options) {
						if(options && options.parent){
							if (options.parent instanceof Array) {
								var i, id, parents = [];
								options.parent.forEach(function(parent) {
									if (id = this.getIdentity(parent)) {
										for(i = parents.length-1; i >= 0; i--) {
											if (parents[i] == id) {
												break;
											}
										}
										if (i < 0) {
											parents.push(id);
										}
									}
								}, this);
								obj.parent = parents;
							} else {
								obj.parent = this.getIdentity(options.parent);
							}
						} else {
							obj.parent = obj.parent || undefined;
						}
						obj.__magic = this.__magic;		// (Note: the 'this' object is the store)
					};
					// Don't make the assumption that store.add() calls store.put() like the
					// dojo/store/Memory store does.
					aspect.before( store, "add", prologue );
					aspect.before( store, "put", prologue );
				}
			} else {
				throw new Error(this.moduleName+"::constructor(): Store parameter is required");
			}
		},

		destroy: function(){
			// summary:
			//		Distroy this model.
			var handle, id;
			for(id in this.childrenCache){
				this._deleteCacheEntry(id);
			}
			// Release memory.
			this.childrenCache = {};
			this._objectCache = {};
			this.store   = undefined;
		},

		// =======================================================================
		// Model getters and setters (See dojo/Stateful)

		_checkedStrictSetter: function (value){
			// summary:
			//		Hook for the set("checkedStrict",value) calls. Note: A full store
			//		re-evaluation is only kicked off when the current value is false
			//		and the new value is true.
			// value:
			//		New value applied to 'checkedStrict'. Any value is converted to a boolean.
			// tag:
			//		private

			value = !!value;
			if (this.checkedStrict !== value) {
				this.checkedStrict = value;
				if (this.checkedStrict) {
					this.getRoot( lang.hitch(this, function (rootItem) {
							this.getChildren(rootItem, lang.hitch(this, function(children) {
									this._validateChildren(rootItem, children);
								}))
						}))
				}
			}
			return this.checkedStrict;
		},

		_enabledAttrSetter: function (/*String*/ value) {
			// summary:
			//		Set the enabledAttr property. This method is the hook for set("enabledAttr", ...)
			//		The enabledAttr value can only be set once during the model instantiation.
			// value:
			//		New enabledAttr value.
			// tags:
			//		private

			if (typeof value === "string") {
				if (this.enabledAttr !== value) {
					throw new Error(this.moduleName+"::set(): enabledAttr property is read-only.");
				}
			} else {
				throw new Error(this.moduleName+"::set(): enabledAttr value must be a string");
			}
			return this.enabledAttr;
		},

		_LabelAttrSetter: function (/*String*/ newValue) {
			// summary:
			//		Set the labelAttr property.
			// newValue:
			//		New labelAttr newValue.
			// tags:
			//		public
			if (newValue && typeof newValue === "string") {
				if (this.labelAttr !== newValue) {
					var oldValue	 = this.labelAttr;
					this.labelAttr = newValue;
					// Signal the event.
					this.onLabelChange(oldValue, newValue);
				}
				return this.labelAttr;
			}
		},

		// =======================================================================
		// Methods for traversing hierarchy

		getChildren: function(/*Object*/ parentItem, /*Function*/ onComplete, /*Function*/ onError) {
			// summary:
			//		Calls onComplete() with array of child items of given parent item,
			//		all loaded.
			// parentItem:
			//		Object.
			// onComplete:
			//		Callback function, called on completion with an array of child items
			//		as the argumen: onComplete(children)
			// onError:
			//		Callback function, called in case an error occurred.
			// tags:
			//		public

			var id = this.getIdentity(parentItem);
			if(this.childrenCache[id]){
				when(this.childrenCache[id], onComplete, onError);
				return;
			}
			var res  = this.store.getChildren(parentItem);
			var self = this;

			// Normalize the children cache. If a store returns a Promise instead of a
			// store.QueryResults, wait for it to resolve so the children cache entries
			// are always of type store.QueryResults.
			when( res, function (queryResult) {
				queryResult.forEach( function(item) {
					self._objectCache[self.getIdentity(item)] = copyObject(item);
				});
				self.childrenCache[id] = queryResult;
			});

			// Setup listener in case children list changes, or the item(s) in the
			// children list are updated in some way. (Only applies to observable
			// stores).

			if(res.observe){
				var handle = res.observe( function(obj, removedFrom, insertedInto) {
					if (insertedInto == -1) {
						when( res, lang.hitch(self, "_onDeleteItem", obj ));
					} else if (removedFrom == -1) {
						when( res, lang.hitch(self, "_onNewItem", obj ));
					} else if (removedFrom == insertedInto) {
						when( res, lang.hitch(self, "_onChange", obj, null));
					} else {
						// insertedInto != removedFrom, this conddition indicates the item
						// moved within the tree.  Typically, this should only happen with
						// DnD operations  and been captured by pasteItem() unless the user
						// is doing some funcky stuff....
						when(res, function(children) {
							children = Array.prototype.slice.call(children);
							self.onChildrenChange(parentItem, children);
						});
					}
				}, true);	// true means to notify on item changes
				res.handle = handle;
			}
			// Call User callback AFTER registering any listeners.
			when(res, onComplete, onError);
		},

		getParents: function (/*Object*/ storeItem) {
			// summary:
			//		Get the parent(s) of a store item. This model supports both single
			//		and multi parented store objects.  For example: parent:"Homer" or
			//		parent: ["Homer","Marge"]. Multi parented stores must have a query
			//		engine capable of querying array properties.
			// storeItem:
			//		The store object whose parent(s) will be returned.
			// returns:
			//		A dojo/promise/Promise
			// tags:
			//		private
			var deferred = new Deferred();
			var parents  = [];

			if (storeItem) {
				var parentIds = new Parents( storeItem, this.parentAttr );
				var promises  = [];
				var parent;

				parentIds.forEach(function (id) {
					parent = this.store.get(id);
					when( parent, function(parent) {
						if (parent) {
							parents.push(parent);
						}
					});
					promises.push(parent);
				}, this);
				/// Wait till we have all parents.
				all(promises).always( function() {
					deferred.resolve(parents);
				});
			} else {
				deferred.resolve(parents);
			}
			return deferred.promise;
		},

		getRoot: function(/*Function*/ onItem, /*Function*/ onError){
			// summary:
			//		Calls onItem with the root item for the tree.
			//		Calls onError on error.
			// onItem:
			//		Function called with the root item for the tree.
			// onError:
			//		Function called in case an error occurred.
			if(this.root){
				onItem(this.root);
			}else{

				var self   = this;

				when( this._storeLoaded, function () {
					var result = self.store.query(self.query);

					when(result, function(items) {
						if(items.length != 1){
							throw new Error(self.moduleName + ": Root query returned " + items.length +
																" items, but must return exactly one item");
						}
						self.root = items[0];
						// Setup listener to detect if root item changes
						if(result.observe) {
							result.observe( function(obj, removedFrom, insertedInto) {
								if (removedFrom == insertedInto) {
									self._onChange( obj, null );
								}
							}, true);	// true to listen for updates to obj
						}
						// Call onItem AFTER registering any listener.
						onItem(self.root);
					}, onError);
				});

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

			var itemId = this.getIdentity(item);
			var result = this.childrenCache[itemId];
			if (result) {
				if (result instanceof Promise) {
					return !result.isFulfilled();
				}
				return !!result.length;
			}
			return true;		// We just don't know at this point.
		},

		// =======================================================================
		// Private Checked state handling

		_getCompositeState: function (/*Object[]*/ children) {
			// summary:
			//		Compile the composite state based on the checked state of a group
			//		of children.	If any child has a mixed state, the composite state
			//		will always be mixed, on the other hand, if none of the children
			//		has a checked state the composite state will be undefined.
			// children:
			//		Array of dojo/store items
			// returns:
			//		Boolean or string: true, false, "mixed" or undefined
			// tags:
			//		private

			var hasChecked	 = false,
					hasUnchecked = false,
					isMixed			= false,
					newState,
					state;

			children.some(function (child) {
				state = this.getChecked(child);
				isMixed |= (state == "mixed");
				switch(state) {	// ignore 'undefined' state
					case true:
						hasChecked = true;
						break;
					case false:
						hasUnchecked = true;
						break;
				}
				return isMixed;
			}, this);
			// At least one checked/unchecked required to change parent state.
			if (isMixed || hasChecked || hasUnchecked) {
				isMixed |= !(hasChecked ^ hasUnchecked);
				newState = (isMixed ? "mixed" : hasChecked ? true: false);
			}
			return newState;
		},

		_normalizeState: function (/*Object*/ storeItem, /*Boolean|String*/ state) {
			// summary:
			//		Normalize the checked state value so we don't store an invalid state
			//		for a store item.
			//	storeItem:
			//		The store item whose checked state is normalized.
			//	state:
			//		The checked state: 'mixed', true or false.
			// tags:
			//		private

			if (typeof state == "boolean") {
				return state;
			}
			if (this.multiState && state == "mixed") {
				if (this.normalize && !this.mayHaveChildren(storeItem)){
						return true;
				}
				return state;
			}
			return state ? true : false;
		},

		_setChecked: function (/*Object*/ storeItem, /*Boolean|String*/ newState) {
			// summary:
			//		Set/update the checked state on the dojo/store item. Returns true if
			//		the checked state changed otherwise false.
			// description:
			//		Set/update the checked state on the dojo.store.	Retreive the
			//		current checked state	and validate if an update is required, this
			//		will keep store updates to a minimum. If the current checked state
			//		is undefined (ie: no checked attribute specified in the store) the
			//		'checkedAll' attribute is tested to see if a checked state needs to
			//		be created.	In case of the root node the 'checkedRoot' attribute
			//		is checked.
			//
			//		NOTE: The _setValue() method will add the attribute for the
			//					item if none exists.
			//
			//	storeItem:
			//		The item in the dojo.store whose checked state is updated.
			//	newState:
			//		The new checked state: 'mixed', true or false.
			//	returns:
			//		Boolean, true or false;
			//	tag:
			//		private

			var forceUpdate = false,
					normState;

			normState		= this._normalizeState(storeItem, newState);
			forceUpdate = (normState != newState);

			var currState = storeItem[this.checkedAttr];
			if ((currState !== undefined || this.checkedAll) && (currState != normState || forceUpdate)) {
				this._setValue(storeItem, this.checkedAttr, normState);
				return true;
			}
			return false;
		},

		_updateCheckedChild: function (/*Object*/ storeItem, /*Boolean*/ newState) {
			//	summary:
			//		Set the parent (the storeItem) and all childrens states to true/false.
			//	description:
			//		If a parent checked state changed, all child and grandchild states are
			//		updated to reflect the change. For example, if the parent state is set
			//		to true, all child and grandchild states will receive that same 'true'
			//		state.
			//
			//	storeItem:
			//		The parent store item whose child/grandchild states require updating.
			//	newState:
			//		The new checked state.
			//	tag:
			//		private

			// Set the (maybe) parent first. The order in which any child checked states
			// are set is important to optimize _updateCheckedParent() performance.
			var self= this;

			this._setChecked(storeItem, newState);
			this.getChildren(storeItem, function (children) {
					children.forEach(function (child) {
						self._updateCheckedChild(child, newState);
					});
				},
				function (err) {
					console.error(err);
				} );
		},

		_updateCheckedParent: function (/*Object*/ storeItem, /*Boolean*/ forceUpdate) {
			//	summary:
			//		Update the parent checked state according to the state of all its
			//		children checked states.
			//	storeItem:
			//		The store item (child) whose parent state requires updating.
			//	forceUpdate:
			//		Force an update of the parent(s) regardless of the current checked
			//		state of the child.
			//	tag:
			//		private

			if (!this.checkedStrict || !storeItem) {
				return;
			}
			var parents		 = this.getParents(storeItem),
					childState = this.getChecked(storeItem),
					self       = this,
					newState;

			when(parents, function (parents) {
				parents.forEach(function (parentItem) {
					// Only process a parent update if the current child state differs from
					// its parent otherwise the parent is already up-to-date.
					if ((childState !== self.getChecked(parentItem)) || forceUpdate) {
						self.getChildren(parentItem, function (children) {
								newState = self._getCompositeState(children);
								if(newState !== undefined) {
									self._setChecked(parentItem, newState);
								}
							},
							self.onError);
					}
				}, this); /* end forEach() */
			});
		},

		_validateChildren: function ( parent, children) {
			// summary:
			//		Validate/normalize the parent(s) checked state in the dojo/store.
			// description:
			//		All parent checked states are set to the appropriate state according to
			//		the actual state(s) of their children. This will potentionally overwrite
			//		whatever was specified for the parent in the dojo/store.
			//		This will garantee the tree is in a consistent state after startup.
			//	parent:
			//		The parent item.
			//	children:
			//		Either the tree root or a list of child children
			//	tag:
			//		private

			var children,	currState, newState;
			this._validating += 1;

			children = children instanceof Array ? children : [children];
			children.forEach(function (child) {
				this.getChildren( child, lang.hitch(this, function(children) {
						this._validateChildren(child, children);
					}),
					function (err) {
						console.error(err);
					});
			}, this	);
			newState	= this._getCompositeState(children);
			currState = this.getChecked(parent);

			if (currState !== undefined && newState !== undefined) {
				this._setChecked(parent, newState);
			}

			// If the validation count drops to zero we're done.
			this._validating--;
			if (!this._validating) {
				this.onDataValidated();
			}
		},

		// =======================================================================
		// Checked and Enabled state

		getChecked: function (/*Object*/ storeItem) {
			// summary:
			//		Get the current checked state from the data store for the specified item.
			// description:
			//		Get the current checked state from the dojo.store. The checked state
			//		in the store can be: 'mixed', true, false or undefined. Undefined in this
			//		context means no checked identifier (checkedAttr) was found in the store
			//		Depending on the checked attributes as specified above the following will
			//		take place:
			//
			//		a)	If the current checked state is undefined and the checked attribute
			//				'checkedAll' or 'checkedRoot' is true one will be created and the
			//				default state 'checkedState' will be applied.
			//		b)	If the current state is undefined and 'checkedAll' is false the state
			//				undefined remains unchanged and is returned. This will prevent a tree
			//				node from creating a checkbox or other widget.
			//
			// storeItem:
			//		The item in the dojo.store whose checked state is returned.
			// returns:
			//		Boolean or string: true, false, "mixed" or undefined
			// tag:
			//		private

			if (storeItem == this.root && !this.checkedRoot) {
				return;
			}
			var checked = storeItem[this.checkedAttr];
			if (checked === undefined)
			{
				if (this.checkedAll) {
					this._setChecked(storeItem, this.checkedState);
					return this.checkedState;
				}
			}
			return checked;	// the current checked state (true/false/'mixed' or undefined)
		},

		getEnabled: function (/*item*/ item) {
			// summary:
			//		Returns the current 'enabled' state of an item as a boolean.
			// item:
			//		Store or root item
			// returns:
			//		Boolean, true or false
			// tag:
			//		Public
			var enabled = true;

			if (this.enabledAttr) {
				enabled = item[this.enabledAttr];
			}
			return (enabled === undefined) || !!enabled;
		},

		getItemState: function (/*item*/ item) {
			// summary:
			//		Returns the state of a item, the state is an object with two properies:
			//		'checked' and 'enabled'.
			// item:
			//		The store or root item.
			// returns:
			//		A JavaScript object with two properties: 'checked' and 'enabled'
			// tag:
			//		Public
			return { checked: this.getChecked(item),
								enabled: this.getEnabled(item) };
		},

		setChecked: function (/*Object*/ storeItem, /*Boolean*/ newState) {
			// summary:
			//		Update the checked state for the store item and the associated parents
			//		and children, if any.
			// description:
			//		Update the checked state for a single store item and the associated
			//		parent(s) and children, if any. This method is called from the tree if
			//		the user checked/unchecked a checkbox. The parent and child tree nodes
			//		are updated to maintain consistency if 'checkedStrict' is set to true.
			//	storeItem:
			//		The item in the dojo.store whose checked state needs updating.
			//	newState:
			//		The new checked state: 'mixed', true or false
			// tags:
			//		private

			if (!this.checkedStrict) {
				this._setChecked(storeItem, newState);		// Just update the checked state
			} else {
				this._updateCheckedChild(storeItem, newState); // Update children and parent(s).
			}
		},

		setEnabled: function (/*item*/ item, /*Boolean*/ value) {
			// summary:
			//		Sets the new 'enabled' state of an item.
			// item:
			//		Store or root item
			// tag:
			//		Public
			if (this.enabledAttr) {
				return this._setValue(item, this.enabledAttr, !!value);
			}
		},

		validateData: function () {
			// summary:
			//		Validate/normalize the parent-child checked state relationship. If the
			//		attribute 'checkedStrict' is true this method is called as part of the
			//		post creation of the Tree instance.
			//	tag:
			//		private
			var self = this;

			when( this.storeLoader.call(this.store),
				function () {
					self._storeLoaded.resolve();
					if (self.checkedStrict && self._validateStore) {
						if (!self.store.isValidated) {
							self.getRoot( function (rootItem) {
								self.getChildren(rootItem, function (children) {
									self._validateChildren(rootItem, children);
								}, self.onError);
							}, self.onError);
						} else {
							self.onDataValidated();		// Trigger event.
						}
					} else {
						self.store.isValidated = true;
					}
				}
			);

		},

		// =======================================================================
		// Inspecting items

		fetchItemByIdentity: function(/* object */ kwArgs){
			// summary:
			//		Fetch a store item by identity
			when( this.store.get(kwArgs.identity),
				lang.hitch(kwArgs.scope, kwArgs.onItem),
				lang.hitch(kwArgs.scope, kwArgs.onError)
			);
		},

		getIcon: function(/*item*/ item){
			// summary:
			//		Get the icon for item from the store if the iconAttr property of the
			//		model is set.
			// item:
			//		A valid dojo.store item.

			if (this.iconAttr) {
				return item[this.iconAttr];
			}
		},

		getIdentity: function(/*item*/ item){
			// summary:
			//		Get the identity of an item.
			return this.store.getIdentity(item);	// Object
		},

		getLabel: function(/*Object*/ item){
			// summary:
			//		Get the label for an item
			if (item === this.root && this.rootLabel) {
				return this.rootLabel;
			}
			return item[this.labelAttr];	// String
		},

		isItem: function(/*any*/ something){
			// summary:
			//		Validate if an item (something) is an object and under control of
			//		this model and store.  This method is primarily called by the DnD
			//		module dndSource.
			// something:
			//		Any type of object.
			// tag:
			//		Public
			if (Object.prototype.toString.call(something) == "[object Object]") {
				if (something.__magic == this.store.__magic) {
					return true;
				}
			}
			return false;
		},

		// =======================================================================
		// Write interface

		_setValue: function (/*Object*/ item, /*String*/ property, /*any*/ value) {
			// summary:
			//		Set the new value of a store item property and fire the 'onChange'
			//		event if the store is not observable.
			//item:
			//		Store object
			// property:
			//		Object property name
			// value:
			//		New value to be assigned.
			// returns:
			//		Promise, number or string.
			// tag:
			//		Private
			if (item[property] !== value) {
				var orgItem = copyObject(item);
				var result;

				// Keep a shallow copy of the item for property comparison later.
				this._objectCache[this.getIdentity(item)] = orgItem;

				item[property] = value;
				result = this.store.put( item, {overwrite: true});

				if (!this._monitored) {
					when( result, lang.hitch( this, "_onChange",  item, orgItem));
				}
				return result;
			}
			return this.getIdentity(item);
		},

		deleteItem: function (/*Object*/ storeItem){
			// summary:
			//		Delete a store item.
			// storeItem:
			//		The store item to be delete.
			// tag:
			//		public

			var method = this.store.remove;
			if (method && typeof method === "function") {
				var itemId = this.getIdentity(storeItem);
				method.call(this.store, itemId);

				// If this store is not observable we need to trigger all the appropriate
				// events for the tree.
				if (!this._monitored) {
					this._onDeleteItem(storeItem);
				}
				return true;
			}
		},

		newItem: function(/*dijit/tree/dndSource.__Item*/ args, /*Item*/ parent, /*int?*/ insertIndex, /*Item*/ before){
			// summary:
			//		Creates a new item.   See `dojo/data/api/Write` for details on args.
			//		Used in drag & drop when item from external source dropped onto tree
			//		or can be called programmatically. Whenever this method is called by
			//		Drag-n-Drop it is a clear indication that DnD determined the item to
			//		be  external to the model and tree however, that doesn't  mean there
			//		isn't a similar item in our store. If the item exists the store type
			//		will determine the appropriate operation. (insert or move)
			// args:
			//		A javascript object defining the initial content of the item as a set
			//		of JavaScript key:value pairs object.
			// parent:
			//		A valid store item that will serve as the parent of the new item.
			// insertIndex:
			//		Not used.
			// before:
			// returns:
			//		A dojo/promise/Promise
			// tag:
			//		Public

			var newParents = parent instanceof Array ? parent : [parent];
			var mpStore    = newParents[0][this.parentAttr] instanceof Array;
			var itemId     = this.getIdentity(args);
			var self       = this;
			var result;

			parent = mpStore ? newParents : newParents[0];

			if (itemId) {
				result = when( this.store.get(itemId), function(item) {
					if (item) {
						// An item in the store with the same identification already exists.
						var parentIds  = new Parents(item);

						// If the store is multi-parented add the new parent otherwise just
						// move the item to its new parent.
						if (mpStore) {
							newParents.forEach( function (aParent) {
								parentIds.add( self.getIdentity(aParent), true );
							});
							self._setValue( item, self.parentAttr, parentIds.toValue());
						} else {
							// Single parented store, move the item.
							when (self.getParents(item), function (oldParents) {
								if (oldParents.length) {
									self.pasteItem( item, oldParents[0], newParents[0], false, insertIndex, before );
								} else {
									// TODO:	Parent no longer exist. Should we update the parent
									//				property accordingly or just leave it as it?
								}
							});
						}
						return item;
					} else {
						// It's a new item to the store so just add it.
						result = self.store.put(args, { parent: parent, before: before });
						return when( result, function(itemId) {
							when (self.store.get(itemId), function(item) {
								if (!this._monitored) {
									when( result, lang.hitch( self, "_onNewItem",  item));
								}
								return item;
							});
						});
					}
				});
				return result;
			}
			// It's a new item without a predefined identification, just add it and the store
			// should generate a unique id.
			result = this.store.put(args, { parent: parent, before: before });
			return when( result, function(itemId) {
				when (self.store.get(itemId), function(item) {
					if (!this._monitored) {
						when( result, lang.hitch( self, "_onNewItem",  item));
					}
					return item;
				});
			});
		},

		pasteItem: function(/*Item*/ childItem, /*Item*/ oldParentItem, /*Item*/ newParentItem,
												 /*Boolean*/ bCopy, /*int?*/ insertIndex, /*Item*/ before){
			// summary:
			//		Move or copy an item from one parent item to another.
			//		Used in drag & drop

			var parentIds   = new Parents( childItem, this.parentAttr );
			var newParentId = this.getIdentity(newParentItem);

			if(!bCopy){
				//	In order for DnD moves to work correctly, childItem needs to be orphaned
				//	from oldParentItem before being adopted by newParentItem.  That way, the
				//	TreeNode is moved rather than an additional TreeNode being created, and
				//	the old TreeNode subsequently being deleted.
				//	The latter loses information such as selection and opened/closed children
				//	TreeNodes.
				//	Unfortunately simply calling this.store.put() will send notifications in a
				//	random order, based on when the TreeNodes in question originally appeared,
				//	and not based on the drag-from TreeNode vs. the drop-onto TreeNode.

				var oldParentId = this.getIdentity(oldParentItem);
				var oldParentChildren = this.childrenCache[oldParentId];
				var self = this;

				parentIds.remove(oldParentId);
				when( oldParentChildren, function(children) {
					var index = children.indexOf(childItem);
					children.splice(index,1);
					children.total = children.length;
					self.onChildrenChange(oldParentItem, children);
				});
			}

			parentIds.add(newParentId);
			this._setValue( childItem, this.parentAttr, parentIds.toValue() );
		},

		// =======================================================================
		// Callbacks

		onChange: function(/*===== item, attribute, newValue =====*/){
			// summary:
			//		Callback whenever an item has changed, so that Tree
			//		can update the label, icon, etc.
			// tags:
			//		callback
		},

		onChildrenChange: function(/*Object*/ parent, /*Object[]*/ newChildrenList){
			// summary:
			//		Callback to do notifications about new, updated, or deleted child items.
			// parent:
			// newChildrenList:
			//
			// NOTE:
			// 		Because observable.js uses 'inMethod' to determine if one store method
			//		is called from within another store method we MUST schedule the update
			//		of the parent item as a separate task otherwise observable.js will not
			//		fire any events associated with the parent update.
			//
			// tags:
			//		callback
			var first = newChildrenList[0];
			var self  = this;

			setTimeout( function () {
				self._updateCheckedParent(first, true);
			}, 0);
		},

		onDataValidated: function(){
			// summary:
			//		Callback when store validation completion. Only called if strict
			//		parent-child relationship is enabled.
			// tag:
			//		callback
			this.store.validated = true;
		},

		onDelete: function(/*===== item =====*/){
			// summary:
			//		Callback when an item has been deleted.
			// description:
			//		Note that there will also be an onChildrenChange() callback for the parent
			//		of this item.
			// tags:
			//		callback
		},

		onLabelChange: function (/*===== oldValue, newValue =====*/){
			// summary:
			//		Callback when label attribute property changed.
			// tags:
			//		callback
		},

		// =======================================================================
		// Internal event listeners.

		_onChange: function (/*Object*/ newItem, /*Object?*/ oldItem) {
			// summary:
			//		Test which of the item properties changed, if an existing property was
			//		removed or if a new property was added.
			// newItem:
			//		An updated store item.
			// oldItem:
			//		The original store item, that is, before the store update. If oldItem
			//		is not specified the cache is search for a  match.
			// tag:
			//		Private
			oldItem = oldItem || this._objectCache[this.getIdentity(newItem)];
			if (oldItem) {
				var key;
				//  First, test if an existing property has changed value or if it was
				//	removed.
				for (key in oldItem) {
					if (key in newItem) {
						if (oldItem[key] != newItem[key]) {
							this.onSetItem(newItem, key, oldItem[key], newItem[key]);
						}
					} else {
						this.onSetItem(newItem, key, oldItem[key], undefined);
					}
				}
				// Second, test if a newproperty was added.
				for (key in newItem) {
					if (!(key in oldItem)) {
						this.onSetItem(newItem, key, undefined, newItem[key]);
					}
				}
			}
			// Keep a shallow copy of the item for later property comparison.
			this._objectCache[ this.getIdentity(newItem)] = copyObject(newItem);
		},

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
			when(this.store.get(id), function(exists) {
				if (!exists) {
					self._deleteCacheEntry(id);
					delete self._objectCache[id];
				}
			});
			self.onDelete(item);

			// Check if it affects the root.
			when( this.getParents(item), function (parents) {
				parents.some(function (parent) {
					if (parent == self.root) {
						self.onRootChange(item, "delete");
						return true;
					}
				});
				self._childrenChanged( parents );
			});
		},

		_onNewItem: function (/*Object*/ item) {
			// summary:
			//		Mimic the dojo/data/ItemFileReadStore onNew event.
			// item:
			//		The store item that was added.
			// tag:
			//		Private
			var self = this;

			// Check if it affects the root.
			when( this.getParents(item), function (parents) {
				parents.some(function (parent) {
					if (parent == self.root) {
						self.onRootChange(item, "new");
						return true;
					}
				});
				self._childrenChanged( parents );
			});
		},

		_onStoreEvent: function (event) {
			// summary:
			//		Common store event listener for evented stores.  An evented store
			//		typically dispatches three types of events: 'update', 'delete' or
			//		'new'.
			// event:
			//		Event recieved from the store.
			// tag:
			//		Private
			switch (event.type) {
				case "update":
					this._onChange( event.item, null );
					break;
				case "delete":
					this._onDeleteItem(event.item);
					break;
				case "new":
					this._onNewItem(event.item);
					break;
			}
		},

		onSetItem: function (/*dojo.store.item*/ storeItem, /*string*/ property, /*AnyType*/ oldValue,
													/*AnyType*/ newValue) {
			// summary:
			//		Updates the tree view according to changes in the data store.
			// storeItem:
			//		Store item
			// property:
			//		property-name-string
			// oldValue:
			//		Old attribute value
			// newValue:
			//		New attribute value.
			// tags:
			//		extension
			var self = this;

			if (property === this.checkedAttr) {
				setTimeout( function () {
					self._updateCheckedParent(storeItem, false);
				}, 0);
			} else if (property === this.parentAttr) {
				var np = new Parents(newValue);
				var op = new Parents(oldValue);
				var dp = [];

				np.forEach( function(parent) {
					if(!op.contains(parent) && self._objectCache[parent]) {
						dp.push(self._objectCache[parent]);
					}
				});

				op.forEach( function(parent) {
					if(!np.contains(parent) && self._objectCache[parent]) {
						dp.push(self._objectCache[parent]);
					}
				});
				self._childrenChanged( dp );
			}
			this.onChange(storeItem, property, newValue);
		},

		onRootChange: function (/*Object*/ storeItem, /*String*/ action) {
			// summary:
			//		Handler for any changes to root children.
			// storeItem:
			//		The store item that was attached to, or detached from, the root.
			// action:
			//		String detailing the type of event: "new", "delete", "attach" or
			//		"detach"
			// tag:
			//		callback
		},

		toString: function () {
			return "[object ObjectStoreModel]";
		},

		//=========================================================================
		// Misc helper methods

		_childrenChanged: function (/*Object[]*/ parents) {
			// summary:
			//		Notify the tree the children of parents have changed. This method is
			//		called by the internal event listeners and the model API.
			// parents:
			//		An array of store items.
			// tag:
			//		Private
			var self = this;

			if (parents && parents.length) {
				parents.forEach(function(parent) {
					self._deleteCacheEntry(self.getIdentity(parent));
					self.getChildren(parent, function(children) {
						self.onChildrenChange(parent, children.slice(0) );
					});
				});
			}
		},

		_deleteCacheEntry: function (id) {
			// summary:
			//		Delete an entry from the childrens cache and remove the associated
			//		observer if any.
			// id:
			//		Store item identification.
			// tag:
			//		Private
			if (this.childrenCache[id]) {
				this.childrenCache[id].handle && this.childrenCache[id].handle.remove();
				delete this.childrenCache[id];
			}
		}

	});
});
