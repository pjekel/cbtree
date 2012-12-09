//
// Copyright (c) 2010-2013, Peter Jekel
// All rights reserved.
//
//  The Checkbox Tree (cbtree), also known as the 'Dijit Tree with Multi State Checkboxes'
//  is released under to following three licenses:
//
//  1 - BSD 2-Clause               (http://thejekels.com/cbtree/LICENSE)
//  2 - The "New" BSD License       (http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//  3 - The Academic Free License   (http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//
//  In case of doubt, the BSD 2-Clause license takes precedence.
//
define(["dojo/_base/declare",   // declare
        "dojo/_base/lang",      // lang.hitch()
        "dojo/aspect",          // aspect.before()
        "dojo/Deferred",
        "dojo/on",              // on()
        "dojo/promise/all",
        "dojo/promise/Promise",  // instanceof
        "dojo/Stateful",        // get() and set()
        "dojo/when",            // when()
        "./_Parents",
        "../shim/Array"          // ECMA-262 Array shim
       ], function (declare, lang, aspect, Deferred, on, all, Promise, Stateful, when, Parents) {
  "use strict";
    // module:
    //    cbtree/model/TreeStoreModel
    // summary:
    //    Implements cbtree/models/model API connecting to any store that exposes
    //    the dojo/store/api/Store API.
    //    The model supports observable, non-observable and evented stores. Both
    //    synchronous and asynchronous store implementations are supported.
    //
    //    Store Types:
    //
    //    - An observable store monitors the results of previously executed queries.
    //      Any changes to the store that effect the outcome of those queries result
    //      in an automatic update of the query results and a call to the observers
    //      callback function.
    //
    //    - An evented store will dispatch an event whenever a store item is added,
    //      deleted or updated. The events are NOT associated with any query.
    //
    //    Which store to use:
    //
    //      myStore = Observable( new Memory( ...) );
    //
    //    Although an observable store may seem the most obvious choice there is a
    //    significant overhead associated with this type of store simply because it
    //    keeps track of all previous executed store queries.  Fetching children of
    //    any tree nodes results in the creation of such query. Therefore, on large
    //    datasets (large trees) you can end up with hundreds of queries and as a
    //    result each change to the store will result in running all those queries
    //    against the newly added, deleted or changed store item.
    //
    //      myStore = Evented( new Memory( ... ) );
    //
    //    An evented store dispatches an event each time the store changes, that is,
    //    an item is added, deleted or changed. It merely notifies the model of the
    //    type of store operation performed and does NOT run potentially hundreds or
    //    even thousands of queries each time the store changes.
    //
    //      myStore = new Memory( ... )
    //
    //    The basic dojo/store, please note that Memory is just one implementation of
    //    the dojo/store API. Any store that complies with the dojo/store API can be
    //    used with this model. In case of direct use of a store, that is, not evented
    //    or observable the model will automatically generate the required events for
    //    the tree. However, any changes to the store outside the scope of the model
    //    will NOT be captured. For example, if you application modifies the store in
    //    any way of fashion by performing direct operations on it like store.put() or
    //    store.remove() than those changes will NOT be reflected in the tree and the
    //    internal cache will be out of sync. If however, you have static store content
    //    and nothing else is operating on the store then the basic store offers the
    //    best performance and least amount of overhead.

  var  moduleName = "cbTree/model/TreeStoreModel";
  var undef;

  function prologue (/*Object*/ object,/*Store.PutDirectives*/ options) {
    // summary:
    //    The prologue method is added to the stores add and put methods as before
    //    advice to provide support for the 'parent' property of store objects.
    //    This method looks for two things:
    //
    //      1 -  First, if the options parameter contains a "parent" property.
    //      2 -  Second, if the store has a "multiParented" property.
    //
    //    If the store has the 'multiParented' property it is assumed the store
    //    will handle the assignment of the objects parent property otherwise
    //    this prologue method will take care of it onbehalf of the store.
    //
    //    NOTE: The prologue method is executed in the context of the store thus
    //          the 'this' object is the store itself.
    // object:
    //    The object to store.
    // options:
    //    Additional metadata for storing the object which may include a 'parent'
    //    property.
    // tag:
    //    Private

    function setParentId(/*Object*/ object,/*Store.PutDirectives?*/ options) {
      // summary:
      //    Set the parent property of a store object.
      // object:
      //    The object to store.
      // tag:
      //    Private
      var objectId = this.getIdentity(object);
      var parents  = options.parent;
      var parentId, np;
      var undef, i;

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
        } else {
          np = undef;
        }
      }
      return np;
    } /* end setParentId() */

    if (options && options.parent && this.multiParented == undefined) {
      object[this.parentProperty] = setParentId.call(this, object, options);
    }
    object.__magic = this.__magic;    // (Note: the 'this' object is the store)
  }

  return declare([Stateful], {

    //==============================
    // Keyword arguments (kwArgs) to constructor

    // checkedAll: Boolean
    //    If true, every store item will receive a 'checked' state property regard-
    //    less if the 'checked' property is specified in the dojo.store
    checkedAll: true,

    // checkedState: Boolean
    //    The default state applied to every store item unless otherwise specified
    //    in the dojo.store (see also: checkedAttr)
    checkedState: false,

    // checkedRoot: Boolean
    //    If true, the root node will receive a checked state. This property is
    //    independent of  the showRoot property of the tree itself. If the tree
    //    property showRoot is set to false the checked state for the root will
    //    not show either.
    checkedRoot: false,

    // checkedStrict: Boolean
    //    If true, a strict parent-child relation is maintained.   For example,
    //    if all children are checked the parent will automatically recieve the
    //    same checked state or if any of the children are unchecked the parent
    //    will, depending if multi state is enabled, recieve either a mixed or
    //    unchecked state.
    checkedStrict: true,

    // checkedAttr: String
    //    The property name of a store object that holds the 'checked' state. On
    //    load it specifies the store items initial checked state.  For example:
    //        { name:'Egypt', type:'country', checked: true }
    //    If a store item has no 'checked' property specified it will depend on
    //    the model property checkedAll if one will be created automatically and
    //    if so, its initial state will be set as specified by 'checkedState'.
    checkedAttr: "checked",

    // enabledAttr: String
    //    The property name of a store object that holds the 'enabled' state of
    //    the checkbox or alternative widget.
    //    Note: Eventhough it is referred to as the 'enabled' state the tree will
    //    only use this property to enable/disable the 'ReadOnly' property of a
    //    checkbox. This because disabling a widget may exclude it from HTTP POST
    //    operations.
    enabledAttr:"",

    // iconAttr: String
    //    If specified, get the icon from an item using this property name.
    iconAttr: "",

    // labelAttr: String
    //    If specified, get label for tree node from this property.
    labelAttr: "name",

    // multiState: Boolean
    //    Determines if the checked state needs to be maintained as multi state
    //    or as a dual state. ({"mixed",true,false} vs {true,false}).
    multiState: true,

    // normalize: Boolean
    //    When true, the checked state of any non branch checkbox is normalized,
    //    that is, true or false.    When normalization is enabled any checkbox
    //    associated with tree leafs can never have a mixed state.
    normalize: true,

    // parentProperty: String
    //    The property name of a store object identifying its parent ID(s).
    parentProperty: "parent",

    // query: Object
    //    Specifies the query object used to retrieve children of the tree root.
    //    The query property is a JavaScript key:value pairs type object.
    //    (See also: forest)
    // example:
    //    {type:'continent'}
    query: null,

    // rootLabel: String
    //    Alternative label of the root item
    rootLabel: null,

    // store: dojo/store
    //    Underlying store. The store MUST implement the dojo/store/api/Store API.
    store: null,

    // storeLoader: Function
    storeLoader: null,

    // End Parameters to constructor
    //==============================

     // root: [readonly] Object
    //    Pointer to the root item (read only, not a parameter)
    root: null,

    // _forest: Boolean
    //    Indicates if the store data should be handled as a forest or a tree
    //    hierarchy.
    //    - If true, a local root item is fabricated which will serve as the
    //      tree root. The local root does NOT represent any data object in
    //      the store.
    //    - If false, the root query must return exactly one store object as
    //      tree root.
    _forest: false,

    // _validateStore: Boolean
    _validateStore: true,

    // _validating: [private] Number
    //    If not equal to zero it indicates store validation is on going.
    _validating: 0,

    // =======================================================================
    // Constructor

    constructor: function(/* Object */ kwArgs) {
      // summary:
      //    Passed the arguments listed above (store, etc)
      // tags:
      //    private

      this.childrenCache = {};  // map from id to array of children
      this._objectCache  = {};
      this._monitored    = true;
      this._forest       = false;
      this._storeLoaded  = new Deferred();

      declare.safeMixin(this, kwArgs);

      var store = this.store;
      var model = this;

      if (store) {
        if (store.put && typeof store.put === "function") {
          this._writeEnabled = true;
        } else {
          console.warn(moduleName+"::constructor(): store is not write enabled.");
          this._writeEnabled = false;
        }

        // Stick a magic marker on the store if it doesn't have one... The magic
        // marker is used by the isItem() method to determine if an abitrary
        // object is under control of this model and its store.
        if (!store.magic) {
          store.__magic = (Math.random() * 10000000) >>> 0;    // make it a UINT32
        }

        // If the store doesn't have a load() method, like the native dojo/store
        // Memory store, we assume the data is already loaded and available otherwise
        // the model will call the store loader. ( See validateData() )

        if (!this.storeLoader || typeof this.storeLoader != "function") {
          if (store.load && typeof store.load === "function") {
            this.storeLoader = store.load;
          } else {
            this.storeLoader = function () {};
          }
        }

        //  Extend the store to provide support for getChildren() and Drag-n-Drop.
        //  For DnD to work correctly there are two requirements that must be met:
        //
        //    1 - The ID of a parent object, if specified, must be set as the
        //        parent property of the store object.
        //     2 - To determine if an item dropped on the tree is under control
        //        of this model/store or comes from an external source, a store
        //        reference is added to the object. This new store property is
        //        used by the isItem() method.
        //
        if (!store.getChildren) {
          var funcBody = "return this.query({"+this.parentProperty+": this.getIdentity(object)});"
          store.getChildren = new Function("object", funcBody);
        }
        if (this._writeEnabled) {
          // Add support for the 'parent' property. Don't make the assumption
          // that store.add() calls store.put() like the dojo/store/Memory store
          // does.
          if (store.parentProperty) {
            this.parentProperty = store.parentProperty;
          } else {
            store.parentProperty = this.parentProperty;
          }
          aspect.before( store, "add", prologue );
          aspect.before( store, "put", prologue );
        }

        // Test if this store is 'evented', 'observable' or standard. If it is
        // evented register the event listeners.
        if (store.evented === true) {
          on( store, "change, delete, new", lang.hitch(this, this._onStoreEvent));
        } else {
          // If this is a default dojo/store (not observable and not evented) we
          // will have to fire some of the events ourselves.
          if (store.notify && typeof store.notify === "function") {
            this._observable = true;
          } else {
            this._monitored = false;
          }
        }
      } else {
        throw new Error(moduleName+"::constructor(): Store parameter is required");
      }
    },

    destroy: function(){
      // summary:
      //    Distroy this model.
      var handle, id;
      for(id in this.childrenCache) {
        this._deleteCacheEntry(id);
      }
      // Release memory.
      this.childrenCache = {};
      this._objectCache = {};
      this.store   = undef;
    },

    // =======================================================================
    // Model getters and setters (See dojo/Stateful)

    _checkedStrictSetter: function (value) {
      // summary:
      //    Hook for the set("checkedStrict",value) calls. Note: A full store
      //    re-evaluation is only kicked off when the current value is false
      //    and the new value is true.
      // value:
      //    New value applied to 'checkedStrict'. Any value is converted to a boolean.
      // tag:
      //    private

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
      //    Set the enabledAttr property. This method is the hook for set("enabledAttr", ...)
      //    The enabledAttr value can only be set once during the model instantiation.
      // value:
      //    New enabledAttr value.
      // tags:
      //    private

      if (typeof value === "string") {
        if (this.enabledAttr !== value) {
          throw new Error(moduleName+"::set(): enabledAttr property is read-only.");
        }
      } else {
        throw new Error(moduleName+"::set(): enabledAttr value must be a string");
      }
      return this.enabledAttr;
    },

    _LabelAttrSetter: function (/*String*/ newValue) {
      // summary:
      //    Set the labelAttr property.
      // newValue:
      //    New labelAttr newValue.
      // tags:
      //    public
      if (newValue && typeof newValue === "string") {
        if (this.labelAttr !== newValue) {
          var oldValue   = this.labelAttr;
          this.labelAttr = newValue;
          // Signal the event.
          this.onLabelChange(oldValue, newValue);
        }
        return this.labelAttr;
      }
    },

    // =======================================================================
    // Methods for traversing hierarchy

    getChildren: function (/*Object*/ parent, /*Function*/ onComplete, /*Function*/ onError) {
      // summary:
      //    Calls onComplete() with array of child items of given parent item,
      //    all loaded.
      // parent:
      //    Object.
      // onComplete:
      //    Callback function, called on completion with an array of child items
      //    as the argumen: onComplete(children)
      // onError:
      //    Callback function, called in case an error occurred.
      // tags:
      //    public

      var id = this.getIdentity(parent);

      if (this.childrenCache[id]) {
        when(this.childrenCache[id], onComplete, onError);
        return;
      }

      var forestRoot = (this._forest && parent == this.root);
      var result = forestRoot ? this.store.query(this.query) : this.store.getChildren(parent);
      var self   = this;

      this.childrenCache[id] = result;

      // Normalize the children cache. If a store returns a Promise instead of a
      // store.QueryResults, wait for it to resolve so the children cache entries
      // are always of type store.QueryResults.
      when( result, function (queryResult) {
        queryResult.forEach( function (item) {
          self._objectCache[self.getIdentity(item)] = lang.mixin(null, item);
        });
        self.childrenCache[id] = queryResult;
      });

      // Setup listener in case the list of children changes, or the item(s) in
      // the children list are updated in some way. (Only applies to observable
      // stores).

      if (result.observe) {
        var handle = result.observe( function (obj, removedFrom, insertedInto) {
          if (insertedInto == -1) {
            when( result, lang.hitch(self, "_onDeleteItem", obj ));
          } else if (removedFrom == -1) {
            when( result, lang.hitch(self, "_onNewItem", obj ));
          } else if (removedFrom == insertedInto) {
            when( result, lang.hitch(self, "_onChange", obj, null));
          } else {
            // insertedInto != removedFrom, this conddition indicates the item
            // moved within the tree.  Typically, this should only happen with
            // DnD operations  and been captured by pasteItem() unless the user
            // is doing some funcky stuff....
            when(result, function (children) {
              children = Array.prototype.slice.call(children);
              self.onChildrenChange(parent, children);
            });
          }
        }, true);  // true means to notify on item changes
        result.handle = handle;
      }
      // Call User callback AFTER registering any listeners.
      when(result, onComplete, onError);
    },

    getParents: function (/*Object*/ storeItem) {
      // summary:
      //    Get the parent(s) of a store item. This model supports both single
      //    and multi parented store objects.  For example: parent:"Homer" or
      //    parent: ["Homer","Marge"]. Multi parented stores must have a query
      //    engine capable of querying properties whose value is an array.
      // storeItem:
      //    The store object whose parent(s) will be returned.
      // returns:
      //    A dojo/promise/Promise  -> Object[]
      // tags:
      //    private
      var deferred = new Deferred();
      var parents  = [];

      if (storeItem) {
        var parentIds = new Parents( storeItem, this.parentProperty );
        var promises  = [];
        var self      = this;

        parentIds.forEach(function (id) {
          var parent = this.store.get(id);
          if (parent) {
            when( parent, function(parent) {
              if (parent) {
                parents.push(parent);
              }
            });
            promises.push(parent);
          }
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

    getRoot: function(/*Function*/ onItem, /*Function*/ onError) {
      // summary:
      //    Get the tree root. calls onItem with the root item for the tree or
      //    onError on error.
      // onItem:
      //    Function called with the root item for the tree.
      // onError:
      //    Function called in case an error occurred.
      // tag:
      //    Public
      var self = this;

      if (this.root) {
        onItem(this.root);
      } else {
        when( this._storeLoaded, function () {
          var result = self.store.query(self.query);

          when(result, function(items) {
            if (items.length != 1) {
              throw new Error(moduleName + ": Root query returned " + items.length +
                                " items, but must return exactly one item");
            }
            self.root = items[0];
            // Setup listener to detect if root item changes
            if (result.observe) {
              result.observe( function(obj, removedFrom, insertedInto) {
                if (removedFrom == insertedInto) {
                  self._onChange( obj, null );
                }
              }, true);  // true to listen for updates to obj
            }
            self._forest = false;
            onItem(self.root);
          }, onError);
        });
      }
    },

    mayHaveChildren: function(/*Object*/ item) {
      // summary:
      //    Tells if an item has or may have children. Implementing logic here
      //    avoids showing +/- expando icon for nodes that we know don't have
      //    children.
      // item:
      //    Object.
      // tags:
      //    public

      var itemId = this.getIdentity(item);
      var result = this.childrenCache[itemId];
      if (result) {
        if (result instanceof Promise) {
          return !result.isFulfilled();
        }
        return !!result.length;
      }
      return true;    // We just don't know at this point.
    },

    // =======================================================================
    // Private Checked state handling

    _getCompositeState: function (/*Object[]*/ children) {
      // summary:
      //    Compile the composite state based on the checked state of a group
      //    of children.  If any child has a mixed state, the composite state
      //    will always be mixed, on the other hand, if none of the children
      //    has a checked state the composite state will be undefined.
      // children:
      //    Array of dojo/store items
      // returns:
      //    Boolean or string: true, false, "mixed" or undefined
      // tags:
      //    private

      var hasChecked   = false,
          hasUnchecked = false,
          isMixed      = false,
          newState,
          state;

      children.some(function (child) {
        state = this.getChecked(child);
        isMixed |= (state == "mixed");
        switch(state) {  // ignore 'undefined' state
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
      //    Normalize the checked state value so we don't store an invalid state
      //    for a store item.
      //  storeItem:
      //    The store item whose checked state is normalized.
      //  state:
      //    The checked state: 'mixed', true or false.
      // tags:
      //    private

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
      //    Set/update the checked state on the dojo/store item. Returns true if
      //    the checked state changed otherwise false.
      // description:
      //    Set/update the checked state on the dojo.store.  Retreive the
      //    current checked state  and validate if an update is required, this
      //    will keep store updates to a minimum. If the current checked state
      //    is undefined (ie: no checked property specified in the store) the
      //    'checkedAll' property is tested to see if a checked state needs to
      //    be created.  In case of the root node the 'checkedRoot' property
      //    is checked.
      //
      //    NOTE: The _setValue() method will add the property for the
      //          item if none exists.
      //
      //  storeItem:
      //    The item in the dojo.store whose checked state is updated.
      //  newState:
      //    The new checked state: 'mixed', true or false.
      //  returns:
      //    Boolean, true or false;
      //  tag:
      //    private

      var forceUpdate = false,
          normState;

      normState    = this._normalizeState(storeItem, newState);
      forceUpdate = (normState != newState);

      var currState = storeItem[this.checkedAttr];
      if ((currState !== undef || this.checkedAll) && (currState != normState || forceUpdate)) {
        this._setValue(storeItem, this.checkedAttr, normState);
        return true;
      }
      return false;
    },

    _updateCheckedChild: function (/*Object*/ storeItem, /*Boolean*/ newState) {
      //  summary:
      //    Set the parent (the storeItem) and all childrens states to true/false.
      //  description:
      //    If a parent checked state changed, all child and grandchild states are
      //    updated to reflect the change. For example, if the parent state is set
      //    to true, all child and grandchild states will receive that same 'true'
      //    state.
      //
      //  storeItem:
      //    The parent store item whose child/grandchild states require updating.
      //  newState:
      //    The new checked state.
      //  tag:
      //    private

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
      //  summary:
      //    Update the parent checked state according to the state of all its
      //    children checked states.
      //  storeItem:
      //    The store item (child) whose parent state requires updating.
      //  forceUpdate:
      //    Force an update of the parent(s) regardless of the current checked
      //    state of the child.
      //  tag:
      //    private

      if (!this.checkedStrict || !storeItem) {
        return;
      }
      var promise     = this.getParents(storeItem),
          childState = this.getChecked(storeItem),
          self       = this,
          newState;

      promise.then( function (parents) {
        parents.forEach(function (parentItem) {
          // Only process a parent update if the current child state differs from
          // its parent otherwise the parent is already up-to-date.
          if ((childState !== self.getChecked(parentItem)) || forceUpdate) {
            self.getChildren(parentItem, function (children) {
                newState = self._getCompositeState(children);
                if (newState !== undef) {
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
      //    Validate/normalize the parent(s) checked state in the dojo/store.
      // description:
      //    All parent checked states are set to the appropriate state according to
      //    the actual state(s) of their children. This will potentionally overwrite
      //    whatever was specified for the parent in the dojo/store.
      //    This will garantee the tree is in a consistent state after startup.
      //  parent:
      //    The parent item.
      //  children:
      //    Either the tree root or a list of child children
      //  tag:
      //    private

      var children,  currState, newState;
      this._validating += 1;

      children = children instanceof Array ? children : [children];
      children.forEach(function (child) {
        if (this.mayHaveChildren(child)) {
          this.getChildren( child, lang.hitch(this, function(children) {
              this._validateChildren(child, children);
            }),
            function (err) {
              console.error(err);
            });
        } else {
          currState = this.getChecked(child);
          if (currState && typeof currState !== "boolean") {
            this._setValue(child, this.checkedAttr, this._normalizeState(child, currState));
          }
        }

      }, this  );
      newState  = this._getCompositeState(children);
      currState = this.getChecked(parent);

      if (currState !== undef && newState !== undef) {
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
      //    Get the current checked state from the data store for the specified item.
      // description:
      //    Get the current checked state from the dojo.store. The checked state
      //    in the store can be: 'mixed', true, false or undefined. Undefined in this
      //    context means no checked identifier (checkedAttr) was found in the store
      //    Depending on the checked attributes as specified above the following will
      //    take place:
      //
      //    a)  If the current checked state is undefined and the checked property
      //        'checkedAll' or 'checkedRoot' is true one will be created and the
      //        default state 'checkedState' will be applied.
      //    b)  If the current state is undefined and 'checkedAll' is false the state
      //        undefined remains unchanged and is returned. This will prevent a tree
      //        node from creating a checkbox or other widget.
      //
      // storeItem:
      //    The item in the dojo.store whose checked state is returned.
      // returns:
      //    Boolean or string: true, false, "mixed" or undefined
      // tag:
      //    private

      if (storeItem == this.root && !this.checkedRoot) {
        return;
      }
      var checked = storeItem[this.checkedAttr];
      if (checked === undef)
      {
        if (this.checkedAll) {
          this._setChecked(storeItem, this.checkedState);
          return this.checkedState;
        }
      }
      return checked;  // the current checked state (true/false/'mixed' or undefined)
    },

    getEnabled: function (/*item*/ item) {
      // summary:
      //    Returns the current 'enabled' state of an item as a boolean.
      // item:
      //    Store or root item
      // returns:
      //    Boolean, true or false
      // tag:
      //    Public
      var enabled = true;

      if (this.enabledAttr) {
        enabled = item[this.enabledAttr];
      }
      return (enabled === undef) || !!enabled;
    },

    setChecked: function (/*Object*/ storeItem, /*Boolean*/ newState) {
      // summary:
      //    Update the checked state for the store item and the associated parents
      //    and children, if any.
      // description:
      //    Update the checked state for a single store item and the associated
      //    parent(s) and children, if any. This method is called from the tree if
      //    the user checked/unchecked a checkbox. The parent and child tree nodes
      //    are updated to maintain consistency if 'checkedStrict' is set to true.
      //  storeItem:
      //    The item in the dojo.store whose checked state needs updating.
      //  newState:
      //    The new checked state: 'mixed', true or false
      // tags:
      //    private

      if (!this.checkedStrict) {
        this._setChecked(storeItem, newState);    // Just update the checked state
      } else {
        this._updateCheckedChild(storeItem, newState); // Update children and parent(s).
      }
    },

    setEnabled: function (/*item*/ item, /*Boolean*/ value) {
      // summary:
      //    Sets the new 'enabled' state of an item.
      // item:
      //    Store or root item
      // tag:
      //    Public
      if (this.enabledAttr) {
        this._setValue(item, this.enabledAttr, !!value);
      }
    },

    validateData: function () {
      // summary:
      //    Validate/normalize the parent-child checked state relationship. If the
      //    property 'checkedStrict' is true this method is called as part of the
      //    post creation of the Tree instance.
      //  tag:
      //    private
      var options = this.checkedStrict ? {all:true} : null;
      var self    = this;

      when( this.storeLoader.call(this.store, options),
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
              self.onDataValidated();    // Trigger event.
            }
          } else {
            self.store.isValidated = true;
          }
        }
      );

    },

    // =======================================================================
    // Inspecting items

    getIcon: function(/*item*/ item) {
      // summary:
      //    Get the icon for item from the store if the iconAttr property of the
      //    model is set.
      // item:
      //    A valid dojo.store item.

      if (this.iconAttr) {
        return item[this.iconAttr];
      }
    },

    getIdentity: function(/*item*/ item) {
      // summary:
      //    Get the identity of an item.
      return this.store.getIdentity(item);  // Object
    },

    getLabel: function(/*Object*/ item) {
      // summary:
      //    Get the label for an item
      if (item === this.root && this.rootLabel) {
        return this.rootLabel;
      }
      return item[this.labelAttr];  // String
    },

    isItem: function(/*any*/ something) {
      // summary:
      //    Validate if an item (something) is an object and under control of
      //    this model and store.  This method is primarily called by the DnD
      //    module dndSource.
      // something:
      //    Any type of object.
      // tag:
      //    Public
      if (Object.prototype.toString.call(something) == "[object Object]") {
        if (something.__magic == this.store.__magic) {
          return true;
        }
      }
      return false;
    },

    isChildOf: function (/*Object*/ parent, /*Object*/ item) {
      // summary:
      //    Test if an item if a child of a given parent.
      // parent:
      //    The parent object.
      // child:
      //    Child object.
      // returns:
      //    Boolean true or false
      // tag:
      //    Public
      if (parent && item) {
        var parents = new Parents(item, this.parentProperty);
        return parents.contains(this.getIdentity(parent));
      }
      return false;
    },

    // =======================================================================
    // Write interface

    _setValue: function (/*Object*/ item, /*String*/ property, /*any*/ value) {
      // summary:
      //    Set the new value of a store item property and fire the 'onChange'
      //    event if the store is not observable, not evented or when the item
      //    is the forest root.
      //item:
      //    Store object
      // property:
      //    Object property name
      // value:
      //    New value to be assigned.
      // returns:
      //    Promise, number or string.
      // tag:
      //    Private
      if (item[property] !== value) {
        var orgItem = this._objectCache[this.getIdentity(item)] = lang.mixin(null, item);
        var result  = null;
        var self    = this;

        item[property] = value;
        result = this.store.put( item, {overwrite: true});
        if (!this._monitored) {
          when( result, function () { self._onChange(item, orgItem);  });
        }
      }
      return value;
    },

    deleteItem: function (/*Object*/ storeItem) {
      // summary:
      //    Delete a store item.
      // storeItem:
      //    The store item to be delete.
      // tag:
      //    public

      var method = this.store.remove;
      if (method && typeof method === "function") {
        var itemId = this.getIdentity(storeItem);
        method.call(this.store, itemId);

        // If the store is not observable or evented we need to trigger all the
        // appropriate events for the tree.
        if (!this._monitored) {
          this._onDeleteItem(storeItem);
        }
        return true;
      }
    },

    newItem: function(/*dijit/tree/dndSource.__Item*/ args, /*Item*/ parent, /*int?*/ insertIndex, /*Item*/ before) {
      // summary:
      //    Creates a new item.   See `dojo/data/api/Write` for details on args.
      //    Used in drag & drop when an item from an external source is dropped
      //    onto tree.    Whenever this method is called by Drag-n-Drop it is a
      //    clear indication that DnD determined the item to be external to the
      //    model and tree however, that doesn't mean there isn't a similar item
      //    in our store. If the item exist the multi-parent mode will determine
      //    the appropriate operation. (insert or move)
      // args:
      //    A javascript object defining the initial content of the item as a set
      //    of JavaScript key:value pairs object.
      // parent:
      //    A valid store item that will serve as the parent of the new item.
      // insertIndex:
      //    Not used.
      // before:
      //    The tree item before which the new item is to be inserted. Note: the
      //    underlaying store must provide support for the 'before' property of
      //    the Store.PutDirectives. (see dojo/store/api/Store)
      // returns:
      //    A dojo/promise/Promise  --> Object
      // tag:
      //    Public

      var mpStore    = parent[this.parentProperty] instanceof Array;
      var itemId     = this.getIdentity(args);
      var self       = this;
      var result;

      parent = (this._forest && parent == this.root) ? undef : parent;

      if (itemId) {
        result = when( this.store.get(itemId), function(item) {
          if (item) {
            // An item in the store with the same identification already exists.
            var parentIds = new Parents(item, self.parentProperty);

            // If the store is multi-parented add the new parent otherwise just
            // move the item to its new parent.
            if (mpStore) {
              parentIds.add( self.getIdentity(parent), true );
              self._setValue( item, self.parentProperty, parentIds.toValue());
            } else {
              // Single parented store, move the item.
              self.getParents(item).then( function (oldParents) {
                if (oldParents.length) {
                  self.pasteItem( item, oldParents[0], parent, false, insertIndex, before );
                }
              });
            }
            return item;
          } else {
            // It's a new item to the store so just add it.
            result = self.store.put(args, { parent: parent, before: before });
            return when( result, function(itemId) {
              return when (self.store.get(itemId), function(item) {
                if (item) {
                  if (parent == self.root) {
                    self.onRootChange(item, "new");
                  }
                  if (!self._monitored) {
                    when( result, function () { self._onNewItem(item); });
                  }
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
        return when (self.store.get(itemId), function(item) {
          if (item) {
            if (parent == this.root) {
              self.onRootChange(item, "new");
            }
            if (!this._monitored) {
              when( result, function () { self._onNewItem(item); });
            }
          }
          return item;
        });
      });
    },

    pasteItem: function(/*Item*/ childItem, /*Item*/ oldParentItem, /*Item*/ newParentItem,
                         /*Boolean*/ bCopy, /*int?*/ insertIndex, /*Item*/ before) {
      // summary:
      //    Move or copy an item from one parent item to another.
      //    Used in drag & drop

      var parentIds   = new Parents( childItem, this.parentProperty );
      var newParentId = this.getIdentity(newParentItem);
      var oldParentId = this.getIdentity(oldParentItem);
      var updParents  = [newParentItem];
      var self = this;

      if (oldParentId != newParentId) {
        var wasRoot = (oldParentItem == this.root);
        var isRoot  = (newParentItem == this.root);
        if (!bCopy) {
          updParents.push(oldParentItem);
          parentIds.remove(oldParentId);
        }
        if (isRoot || wasRoot) {
          this.onRootChange(childItem, (isRoot ? "attach" : "detach"));
        }
        if (!this._forest || !isRoot) {
          parentIds.add(newParentId);
        }
      }
      // Set the new parent(s) on the object and write it to the store. In order
      // to drag an object amongst its siblings the store MUST support 'before'.
      childItem[this.parentProperty] = parentIds.toValue();
      when (this.store.put( childItem, {before: before}), function () {
        self._childrenChanged( updParents );
      });
    },

    // =======================================================================
    // Callbacks

    onChange: function(/*===== item, property, newValue =====*/){
      // summary:
      //    Callback whenever an item has changed, so that Tree
      //    can update the label, icon, etc.
      // tags:
      //    callback
    },

    onChildrenChange: function(/*Object*/ parent, /*Object[]*/ newChildrenList) {
      // summary:
      //    Callback to do notifications about new, updated, or deleted child items.
      // parent:
      // newChildrenList:
      //
      // NOTE:
      //     Because observable.js uses 'inMethod' to determine if one store method
      //    is called from within another store method we MUST schedule the update
      //    of the parent item as a separate task otherwise observable.js will not
      //    fire any events associated with the parent update.
      //
      // tags:
      //    callback
      var first = newChildrenList[0];
      var self  = this;

      if (this._observable) {
        setTimeout( function () {
          self._updateCheckedParent(first, true);
        }, 0);
      } else {
        self._updateCheckedParent(first, true);
      }
    },

    onDataValidated: function(){
      // summary:
      //    Callback when store validation completion. Only called if strict
      //    parent-child relationship is enabled.
      // tag:
      //    callback
      this.store.validated = true;
    },

    onDelete: function(/*===== item =====*/){
      // summary:
      //    Callback when an item has been deleted.
      // description:
      //    Note that there will also be an onChildrenChange() callback for the parent
      //    of this item.
      // tags:
      //    callback
    },

    onLabelChange: function (/*===== oldValue, newValue =====*/){
      // summary:
      //    Callback when label property property changed.
      // tags:
      //    callback
    },

    onRootChange: function (/*Object*/ storeItem, /*String*/ action) {
      // summary:
      //    Handler for any changes to the forest tree root children.
      // description:
      //    Users can extend this method to modify the new item that's being added
      //    to the root of the tree, for example to make sure the new item matches
      //    the tree root query. Remember, even though the item is dropped on the
      //    tree root it does not quarentee it matches the tree root query unless
      //    the query is simply the store identifier.
      // storeItem:
      //    The store item that was attached to, or detached from, the forest root.
      // action:
      //    String detailing the type of event: "new", "delete", "attach" or
      //    "detach"
      // tag:
      //    callback
    },

    // =======================================================================
    // Internal event listeners.

    _onChange: function (/*Object*/ newItem, /*Object?*/ oldItem) {
      // summary:
      //    Test which of the item properties changed, if an existing property was
      //    removed or if a new property was added.
      // newItem:
      //    An updated store item.
      // oldItem:
      //    The original store item, that is, before the store update. If oldItem
      //    is not specified the cache is search for a  match.
      // tag:
      //    Private
      oldItem = oldItem || this._objectCache[this.getIdentity(newItem)];
      if (oldItem) {
        var key;
        //  First, test if an existing property has changed value or if it was
        //  removed.
        for (key in oldItem) {
          if (key in newItem) {
            if (oldItem[key] != newItem[key]) {
              this.onSetItem(newItem, key, oldItem[key], newItem[key]);
            }
          } else {
            this.onSetItem(newItem, key, oldItem[key], undef);
          }
        }
        // Second, test if a new property was added.
        for (key in newItem) {
          if (!(key in oldItem) && key !== "__magic") {
            this.onSetItem(newItem, key, undef, newItem[key]);
          }
        }
      }
      // Keep a shallow copy of the item for later property comparison.
      this._objectCache[ this.getIdentity(newItem)] = lang.mixin(null, newItem);
    },

    _onDeleteItem: function (/*Object*/ item) {
      // summary:
      //    Handler for delete notifications from the store.
      // item:
      //    The store item that was deleted.
      // tag:
      //    Private
      var id   = this.getIdentity(item);
      var self = this;

      // Because observable does not provide definitive information if the item
      // was actually deleted or just moved (re-parented) we need to check the
      // store and see if the item still exist.
      when(this.store.get(id),
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
        if (self.isChildOf(self.root, item)) {
          self.onRootChange(item, "delete");
        }
        self._childrenChanged( parents );
      });
    },

    _onNewItem: function (/*Object*/ item) {
      // summary:
      //    Mimic the dojo/data/ItemFileReadStore onNew event.
      // item:
      //    The store item that was added.
      // tag:
      //    Private
      var self = this;

      this.getParents(item).then( function (parents) {
        if (self.isChildOf(self.root, item)) {
          self.onRootChange(item, "new");
        }
        self._childrenChanged( parents );
      });
    },

    _onStoreEvent: function (event) {
      // summary:
      //    Common store event listener for evented stores.  An evented store
      //    typically dispatches three types of events: 'update', 'delete' or
      //    'new'.
      // event:
      //    Event recieved from the store.
      // tag:
      //    Private
      switch (event.type) {
        case "change":
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
      //    Updates the tree view according to changes in the data store.
      // storeItem:
      //    Store item
      // property:
      //    property-name-string
      // oldValue:
      //    Old property value
      // newValue:
      //    New property value.
      // tags:
      //    extension
      var parentProp = this.parentProperty;
      var self       = this;

      if (property === this.checkedAttr) {
        if (this._observable) {
          setTimeout( function () {
            self._updateCheckedParent(storeItem, false);
          }, 0);
        } else {
          self._updateCheckedParent(storeItem, false);
        }
      } else if (property === parentProp) {
        var np = new Parents(newValue, parentProp);
        var op = new Parents(oldValue, parentProp);
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

    toString: function () {
      return "[object TreeStoreModel]";
    },

    //=========================================================================
    // Misc helper methods

    _childrenChanged: function (/*Object|Object[]*/ parents) {
      // summary:
      //    Notify the tree the children of parents have changed. This method is
      //    called by the internal event listeners and the model API.
      // parents:
      //    An array of store items.
      // tag:
      //    Private
      var self = this;

      parents = parents instanceof Array ? parents : [parents];
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
      //    Delete an entry from the childrens cache and remove the associated
      //    observer if any.
      // id:
      //    Store item identification.
      // tag:
      //    Private
      if (this.childrenCache[id]) {
        this.childrenCache[id].handle && this.childrenCache[id].handle.remove();
        delete this.childrenCache[id];
      }
    }

  });
});
