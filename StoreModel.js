//
// Copyright (c) 2010-2012, Peter Jekel
// All rights reserved.
//
// Redistribution and use in source and binary forms, with or without modification,
// are permitted provided that the following conditions are met:
//
// 1 Redistributions of source code must retain the above copyright notice, this
//   list of conditions and the following disclaimer.
//
// 2 Redistributions in binary form must reproduce the above copyright notice, this
//   list of conditions and the following disclaimer in the documentation and/or other 
//   materials provided with the distribution.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY
// EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES
// OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT 
// SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, 
// INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED 
// TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR 
// BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN 
// CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY 
// WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
//
define([
  "dijit/tree/TreeStoreModel",
  "dojo/_base/array",
  "dojo/_base/declare",
  "dojo/_base/lang",
  "dojo/_base/window"
], function (TreeStoreModel, array, declare, lang) {

  return declare([TreeStoreModel], { 

    // checkedAll: Boolean
    //    If true, every store item will receive a 'checked' state property regard-
    //    less if the 'checked' attribute is specified in the dojo.data.store
    checkedAll: true,

    // checkedState: Boolean
    //     The default state applied to every store item unless otherwise specified
    //    in the dojo.data.store (see also: checkedAttr)
    checkedState: false,

    // checkedRoot: Boolean
    //    If true, the root node will receive a checked state eventhough it's not
    //    a true entry in the store. This attribute is independent of the showRoot
    //    attribute of the tree itself. If the tree attribute 'showRoot' is set to
    //    false the checked state for the root will not show either.  
    checkedRoot: false,

    // checkedStrict: Boolean
    //    If true, a strict parent-child relation is maintained. For example, 
    //    if all children are checked the parent will automatically recieve the
    //    same checked state or if any of the children are unchecked the parent
    //    will, depending if multi state is enabled, recieve either a mixed or
    //    unchecked state.
    checkedStrict: true,

    // checkedAttr: String
    //    The attribute name (property of the store item) that holds the 'checked'
    //    state. On load it specifies the store items initial checked state.   For
    //    example: { name:'Egypt', type:'country', checked: true } If a store item
    //    has no 'checked' attribute specified it will depend on the model property
    //    'checkedAll' if one will be created automatically and if so, its initial
    //    state will be set as specified by 'checkedState'. 
    checkedAttr: "checked",
    
    // multiState: Boolean
    //    Determines if the checked state needs to be maintained as multi state or
    //    or as a dual state. ({"mixed",true,false} vs {true,false}).
    multiState: true,

    // query: String
    //    Specifies the set of children of the root item.
    // example:
    //    {type:'continent'}
    query: null,
    
    // rootId: String
    //    ID of fabricated root item
    rootId: "$root$",

    // rootLabel: String
    //    Label of fabricated root item
    rootLabel: "ROOT",

    // _identity: [private] String
    //    The identity specified for the store. The identity equates to the 'identifier'
    //    property of the store if any.
    _identity: null,

    // _queryAttrs: [private] array of strings
    //    A list of attribute names included in the query. The list is used to determine
    //    if a re-query of the store is required after a property of a store item has
    //    changed value.
    _queryAttrs: [],
  
 
    _checkOrUncheck: function (/*String|Object*/ query, /*Boolean*/ newState, /*Callback*/ onComplete, 
                                /*Context*/ scope ) {
      // summary:
      //    Check or uncheck the checked state of all store items that match the query.
      // description:
      //    Check or uncheck the checked state of all store items that match the
      //    query. This method is called by either the public methods 'check' or
      //    'uncheck' providing an easy way to programmatically alter the checked
      //    state of a set of store items associated with the tree nodes.
      //
      // query:
      //    A query object or string. If query is a string the label attribute of
      //    the store is used as the query attribute and the query string assigned
      //    as the associated value.
      // newState:
      //    New state to be applied to the store items.
      // onComplete:
      //    If an onComplete callback function is provided, the callback function
      //    will be called just once, after the last storeItem has been updated as: 
      //    onComplete( matches, updates ).
      // scope:
      //    If a scope object is provided, the function onComplete will be invoked
      //    in the context of the scope object. In the body of the callback function,
      //    the value of the "this" keyword will be the scope object. If no scope is
      //    is provided, onComplete will be called in the context of tree.model.
      // tag:
      //    private

      var matches = 0,
          updates = 0;

      this.getStoreItems( query, function ( storeItems ) {
        array.forEach( storeItems, function ( storeItem ) {
          if( this.store.getValue( storeItem, this.checkedAttr) != newState ) {
            this._setCheckedAttr( storeItem, newState );
            updates += 1; 
          }
          matches += 1;
        }, this )
        if( onComplete ) {
          onComplete.call( (scope ? scope : this ), matches, updates );
        }
      }, this );
    },

    _getCheckedAttr: function (/*dojo.data.Item*/ storeItem) {
      // summary:
      //    Get the current checked state from the data store for the specified item.
      //    This is the hook for get(item,"checked")
      // description:
      //    Get the current checked state from the dojo.data store. The checked state
      //    in the store can be: 'mixed', true, false or undefined. Undefined in this
      //    context means no checked identifier (checkedAttr) was found in the store
      //    Depending on the checked attributes as specified above the following will
      //    take place:
      //
      //    a)  If the current checked state is undefined and the checked attribute
      //        'checkedAll' or 'checkedRoot' is true one will be created and the
      //        default state 'checkedState' will be applied.
      //    b)  If the current state is undefined and 'checkedAll' is false the state
      //        undefined remains unchanged and is returned. This will prevent a tree
      //        node from creating a checkbox or other widget.
      //
      // storeItem:
      //    The item in the dojo.data.store whose checked state is returned.
      // tag:
      //    private
      // example:
      //    var currState = model.get(item,"checked");

      var checked;
      
      if ( storeItem != this.root ) {
        checked = this.store.getValue(storeItem, this.checkedAttr);
        if( checked === undefined )
        {
          if( this.checkedAll) {
            this._setCheckedState( storeItem, this.checkedState );
            checked = this.checkedState;
          }
        }
      } 
      else // Fake tree root. (the root is NOT a dojo.data.item).
      {  
        if( this.checkedRoot ) {
          checked = this.root.checked;
        }
      }
      return checked;  // the current checked state (true/false or undefined)
    },

    _getFuncNames: function (/*String*/ name ) {
      // summary:
      //    Helper function for the get() and set() mthods. Returns the function names
      //    in lowerCamelCase for the get and set functions associated with the 'name'
      //    property.
      // name:
      //    Attribute name.
      // tags:
      //    private

      if( typeof name == "string" ) {
        var cc = name.replace(/^[a-z]|-[a-zA-Z]/g, function (c){ return c.charAt(c.length-1).toUpperCase(); });
        var fncSet = { set: "_set"+cc+"Attr", get: "_get"+cc+"Attr" };
        return fncSet;
      }
      throw new Error("StoreModel:_getFuncNames(): get/set attribute name must be of type string.");
    },

    _getStoreIdentity: function () {
      // summary:
      //    Get the identity (identifier) property of the store, if any.
      // tags:
      //    private

      if( this._identity ) {
        return this._identity;
      }
      if( this._identity === null ) {
        var identities = this.store.getIdentityAttributes();
        if( identities ) {
          this._identity = identities[0];
        } else {
          this._identity = undefined;
        }
      }
      return this._identity;
    },

    _getParentsItem: function (/*dojo.data.Item*/ storeItem, /*String?*/ parentRefMap ) {
      // summary:
      //    Get the parent(s) of a dojo.data item.  
      // description:
      //    Get the parent(s) of a dojo.data item. The '_reverseRefMap' entry of
      //    the item is used to identify the parent(s). A child will have a parent
      //    reference if the parent specified the '_reference' attribute. 
      //    For example: children:[{_reference:'Mexico'}, {_reference:'Canada'}, ...
      //
      // storeItem:
      //    The dojo.data.item whose parent(s) will be returned.
      // parentRefMap:
      //    Optional property name of the parent reference map for the store item.
      //    If ommitted the default '_reverseRefMap' property of the store is used.
      // tags:
      //    private

      var parents = [],
          itemId;

      if( storeItem != this.root ) {
        var references = storeItem[ (parentRefMap ? parentRefMap : this.store._reverseRefMap) ];
        if( references ) {
          for(itemId in references ) {
            parents.push( this.store._getItemByIdentity( itemId ) );
          }
        }
        if( parents.length == 0 ) {
          parents.push(this.root);
        }
      }
      return parents // parent(s) of a dojo.data.item (Array of dojo.data.items)
    },

    _getStoreItemAttr: function (/*dojo.data.Item*/ storeItem, /*String*/ attr ) {
      // summary:
      //    Return the attribute value of a dojo.data.store item.  This method
      //    provides the hook for the get(item,attr) method for all store item
      //    attributes other than 'checked'.
      // storeItem:
      //    The item in the dojo.data.store whose attribute value is returned.
      // attr:
      //    Attribute name whose value is returned. 
      // tags:
      //    private

      return this.store.getValue( storeItem, attr )
    },

    _normalizeState: function (/*dojo.data.Item*/ storeItem, /*Boolean|String*/ state ) {
      // summary:
      //    Normalize the checked state value so we don't store an invalid state
      //    for a store item.
      //  storeItem:
      //    The store item whose checked state is normalized.
      //  state:
      //    The checked state: 'mixed', true or false.
      // tags:
      //    private
      
      if( typeof state == "boolean" ) {
        return state;
      }
      if( state == "mixed" ) {
        if( this.multiState && this.mayHaveChildren( storeItem ) ) {
          return state;
        } 
      }
      return state ? true : false;
    },
    
    _requeryTop: function(){
      // summary:
      //    Reruns the query for the children of the root node, sending out an
      //    onChildrenChange notification if those children have changed.
      // tags:
      //    private

      var oldChildren = this.root.children || [];
      this.store.fetch({
        query: this.query,
        onComplete: lang.hitch(this, function(newChildren){
          this.root.children = newChildren;

          // If the list of children or the order of children has changed...
          if(oldChildren.length != newChildren.length ||
            array.some(oldChildren, function(item, idx){ 
                return newChildren[idx] != item;
              })) {
            this.onChildrenChange(this.root, newChildren);
          }
        }) /* end hitch() */
      }); /* end fetch() */
    },

   _setCheckedAttr: function (/*dojo.data.Item*/ storeItem, /*Boolean*/ newState ) {
      // summary:
      //    Update the checked state for the store item and the associated parents
      //    and children, if any. This is the hook for set(item,"checked",value).
      // description:
      //    Update the checked state for a single store item and the associated
      //    parent(s) and children, if any. This method is called from the tree if
      //    the user checked/unchecked a checkbox. The parent and child tree nodes
      //    are updated to maintain consistency if 'checkedStrict' is set to true.
      //  storeItem:
      //    The item in the dojo.data.store whose checked state needs updating.
      //  newState:
      //    The new checked state: 'mixed', true or false
      // tags:
      //    private
      //  example:
      //    model.set( item,"checked",newState );
      
      if( !this.checkedStrict ) {
        this._setCheckedState( storeItem, newState );    // Just update the checked state
      } else {
        this._updateCheckedChild( storeItem, newState ); // Update children and parent(s).
      }
    },

    _setCheckedState: function (/*dojo.data.Item*/ storeItem, /*Boolean|String*/ newState ) {
      // summary:
      //    Set/update the checked state on the dojo.data store. Returns true if
      //    the checked state changed otherwise false.
      // description:
      //    Set/update the checked state on the dojo.data.store.  Retreive the
      //    current checked state  and validate if an update is required, this 
      //    will keep store updates to a minimum. If the current checked state
      //    is undefined (ie: no checked attribute specified in the store) the 
      //    'checkedAll' attribute is tested to see if a checked state needs to
      //    be created.  In case of the root node the 'checkedRoot' attribute
      //    is checked.
      //
      //    NOTE: The store.setValue() method will add the attribute for the
      //          item if none exists.   
      //
      //  storeItem:
      //    The item in the dojo.data.store whose checked state is updated.
      //  newState:
      //    The new checked state: 'mixed', true or false.
      //  tag:
      //    private

      var stateChanged = true,
          oldValue;
          
      newState = this._normalizeState( storeItem, newState );
      if( storeItem != this.root ) {
        var currState = this.store.getValue(storeItem, this.checkedAttr);
        if( (currState !== undefined || this.checkedAll) && (currState != newState ) ) {
          this.store.setValue( storeItem, this.checkedAttr, newState );
        } else {
          stateChanged = false;
        }
      } 
      else  // Tree root instance
      {
        if( this.checkedRoot && ( this.root.checked != newState ) ) {
          oldValue = this.root.checked;
          this.root.checked = newState;
          /*
            As the root is not an actual store item we must call onSetItem() explicitly
            to mimic a store update, in all other events the store will do it for us.
          */
          this.onSetItem( storeItem, this.checkedAttr, oldValue, newState );
        } else {
          stateChanged = false;
        }
      }
      return stateChanged;
    },

    _setStoreItemAttr: function (/*dojo.data.Item*/ storeItem, /*String*/ attr, /*AnyType*/ value ) {
      // summary:
      //    Hook for the set(item,attr,value) method for all attributes other than
      //    'checked'.
      //  storeItem:
      //    The item in the dojo.data.store whose attribute value will be updated.
      // attr:
      //    Attribute name. 
      //  value:
      //    The new value to be applied.
      //  tag:
      //    private

      if( attr == this.store._getIdentifierAttribute() ) {
        throw new Error("StoreModel:set(): identifier attribute: {" + attr + "} can not be changed.");
      }
      return this.store.setValue( storeItem, attr, value );
    },

    _updateCheckedChild: function (/*dojo.data.Item*/ storeItem, /*Boolean*/ newState ) {
      //  summary:
      //    Set the parent (the storeItem) and all childrens states to true/false.
      //  description:
      //    If a parent checked state changed, all child and grandchild states are
      //    updated to reflect the change. For example, if the parent state is set
      //    to true, all child and grandchild states will receive that same 'true'
      //    state.  If a child changes state all of its parents will be updated if
      //    required.
      //
      //  storeItem:
      //    The parent store item whose child/grandchild states require updating.
      //  newState:
      //    The new checked state.
      //  tag:
      //    private

      if( this.mayHaveChildren( storeItem )) {
        this.getChildren( storeItem, lang.hitch( this, 
            function ( children ) {
              array.forEach( children, function (child) {
                  this._updateCheckedChild( child, newState );
                }, 
              this 
              );
            }
          ), // end hitch()
          this.onError 
        ); // end getChildren()
      } 
      else // Item has no children
      {
        if( this._setCheckedState( storeItem, newState ) ) {
          this._updateCheckedParent( storeItem );
        }
      }
    },

    _updateCheckedParent: function (/*dojo.data.Item*/ storeItem, /*String?*/ reverseRefMap ) {
      //  summary:
      //    Update the parent checked state according to the state of all child
      //    checked states.
      //  description:
      //    Update the parent checked state according to the state of all of its
      //    child states. The parent checked state automatically changes if ALL
      //    child states are true or false. If, as a result, the parent checked
      //    state changed, we check if its parent needs updating as well all the
      //    way upto the root. 
      //
      //    NOTE: If any of the children has a mixed state, the parent will
      //          also get a mixed state. On the other hand, if none of the
      //          children has a checked state the parent retains is current
      //          state.
      //
      //  storeItem:
      //    The store item whose parent state requires updating.
      //  tag:
      //    private
      
      var parents = this._getParentsItem( storeItem, reverseRefMap ),
          newState;

      array.forEach( parents, function ( parentItem ) {
        newState = this._getCheckedAttr(parentItem);
        this.getChildren( parentItem, lang.hitch( this,
          function (children) {
            var hasChecked   = false,
                hasUnchecked = false,
                isMixed      = false,
                state;
            array.some( children, function (child) {
              state = this._getCheckedAttr(child);
              isMixed |= ( state == "mixed" );
              switch( state ) {  // ignore 'undefined' state
                case true:
                  hasChecked = true;
                  break;
                case false: 
                  hasUnchecked = true;
                  break;
              }
              return isMixed;
            }, this );
            // At least one checked/unchecked required to change parent state.
            if( isMixed || hasChecked || hasUnchecked ) {
              isMixed |= !(hasChecked ^ hasUnchecked);
              newState = (isMixed ? "mixed" : hasChecked ? true: false);
            }
            if( this._setCheckedState( parentItem,  newState ) ) {
              this._updateCheckedParent( parentItem );
            }
          }),
          this.onError );
      }, this ); /* end forEach() */
    },
    
    _validateData: function (/*dojo.data.Item*/ storeItem ) {
      // summary:
      //    Validate/normalize the parent-child checked state relationship if
      //    the attribute 'checkedStrict' is set to true. This method is called
      //    as part of the post creation of the Tree instance. First we try a
      //    forced synchronous load of the Json datafile dramatically improving
      //    the startup time.
      //
      //  storeItem:
      //    The element to start traversing the dojo.data.store, typically the
      //    (fake) tree root.
      //  tag:
      //    private

      if( this.checkedStrict ) {
        try {
          this.store._forceLoad();    // Try a forced synchronous load
        } catch(e) { 
          console.log(e);
        }
        lang.hitch( this, this._validateStore ) ( storeItem ? storeItem : this.root ); 
      }
    },

    _validateStore: function (/*dojo.data.Item*/ storeItem ) {
      // summary:
      //    Validate/normalize the parent(s) checked state in the dojo.data store.
      // description:
      //    All parent checked states are set to the appropriate state according to
      //    the actual state(s) of their children. This will potentionally overwrite
      //    whatever was specified for the parent in the dojo.data store. This will
      //    garantee the tree is in a consistent state after startup. 
      //  storeItem:
      //    The element to start traversing the dojo.data.store, typically model.root
      //  example:
      //    this._validateStore( storeItem );
      //
      this.getChildren( storeItem, lang.hitch( this,
        function (children) {
          var hasGrandChild = false,
              oneChild = null;          
          array.forEach( children, function ( child ) {
            if( this.mayHaveChildren( child )) {
              this._validateStore( child );
              hasGrandChild = true;
            } else {
              oneChild = child;
            }
          },this );
          if( !hasGrandChild && oneChild ) {  // Found a child on the lowest branch ?
            this._updateCheckedParent( oneChild );
          }
        }),
        this.onError
      );
    },

    check: function (/*Object|String*/ query, /*Callback*/ onComplete, /*Context*/ scope ) {
      // summary:
      //    Check all store items that match the query.
      // description:
      //    See description _checkOrUncheck()
      //  example:
      //    model.check( { name: "John" } ); 
      //  | model.check( "John", myCallback, this );
      //
      this._checkOrUncheck( query, true, onComplete, scope );
    },
    
    constructor: function (/*Object*/ params){
      // summary:
      //    Create the dummy root.
      // description:
      //    Create the dummy root and set the initial checked state for the
      //    tree root.
      // tags:
      //    extension

      // Make dummy root item
      this.root = {
        store: this,
        root: true,
        checked: this.checkedState,
        id: params.rootId,
        label: params.rootLabel,
        children: params.rootChildren  // optional param
      };

      // Compose a list of attribute names included in the query.
      if( this.query ) {
        for( var attr in this.query ) {
          this._queryAttrs.push( attr );
        }
      }
    },

    deleteItem: function (/*dojo.data.Item*/ storeItem ){
      // summary:
      //    Delete a store item.
      // storeItem:
      //    The store item to be delete.
      
      return this.store.deleteItem( storeItem );
    },
    
    fetchItemByIdentity: function(/* object */ keywordArgs){
      // summary:
      // tags:
      //    extension

      if(keywordArgs.identity == this.root.id){
        var scope = keywordArgs.scope ? keywordArgs.scope : win.global;
        if(keywordArgs.onItem){
          keywordArgs.onItem.call(scope, this.root);
        }
      }else{
        this.inherited(arguments);
      }
    },

    get: function (/*dojo.data.Item*/ storeItem , /*String*/ attr){
      // summary:
      //    Provide the getter capabilities for store items thru the model.  The
      //    'get' operates on a store item providing a convenient way to get any
      //    store item properties.
      // storeItem:
      //    The store item whose property to get.
      // attr:
      //    Name of property to get

      if(this.isItem( storeItem )) {
        var func = this._getFuncNames( attr );
        return this[func.get] ? this[func.get](storeItem) : this._getStoreItemAttr( storeItem, attr );
      }
      throw new Error("StoreModel:get(): argument is not a valid store item.");
    },

    getChildren: function(/*dojo.data.Item*/ parentItem, /*function(items)*/ callback, /*function*/ onError){
      // summary:
      //     Calls onComplete() with array of child items of given parent item, all loaded.
      if(parentItem === this.root){
        if(this.root.children){
          // already loaded, just return
          callback(this.root.children);
        }else{
          this.store.fetch({
            query: this.query,
            onComplete: lang.hitch(this, function(items){
              this.root.children = items;
              callback(items);
            }),
            onError: onError
          });
        }
      } else {
        this.inherited(arguments);
      }
    },

    getIdentity: function(/* item */ item){
      // summary:
      // tags:
      //    extension
      return (item === this.root) ? this.root.id : this.inherited(arguments);
    },

    getLabel: function(/* item */ item){
      // summary:
      // tags:
      //    extension
      return  (item === this.root) ? this.root.label : this.inherited(arguments);
    },

    getStoreItems: function (/* String|Object */ query, /* Callback */ onComplete, /* Context */ scope ) {
      // summary:
      //    Get the list of store items that match the query and have a checked 
      //    state, this is, a checkedAttr property.
      // description:
      //    Get the list of store items that match the query and have a checkbed
      //    state. This method provides a simplified interface to the data stores
      //    fetch() method.
      //   query:
      //    A query object or string. If query is a string the label attribute of
      //    the store is used as the query attribute and the query string assigned
      //    as the associated value.
      //  onComplete:
      //     User specified callback method which is called on completion with an
      //    array of store items that matched the query argument. Method onComplete
      //    is called as: onComplete( storeItems ) in the context of scope if scope
      //    is specified otherwise in the active context (this).
      //  scope:
      //    If a scope object is provided, the function onComplete will be invoked
      //    in the context of the scope object. In the body of the callback function,
      //    the value of the "this" keyword will be the scope object. If no scope 
      //    object is provided, onComplete will be called in the context of tree.model.

      var storeItems = [],
          storeQuery = {},
          identity;
        
      if(typeof query == "string"){
        identity = this._getStoreIdentity();
        if( !identity ){
          throw new Error("StoreModel:getStoreItems(): No identity defined for the data store.");
        }
        storeQuery[ identity ] = query;
      } else {
        storeQuery = query;
      }
      
      this.store.fetch( {  
        query: storeQuery,
        //  Make sure ALL items are searched, not just top level items.
        queryOptions: { deep: true },
        onItem: function ( storeItem, request ) {
          // Make sure the item has the appropriate attribute so we don't inadvertently
          // start adding checked state properties.
          if( this.store.hasAttribute( storeItem, this.checkedAttr )) {
            storeItems.push( storeItem );
          }
        },
        onComplete: function () {
          if( onComplete ) {
            onComplete.call( (scope ? scope : this ), storeItems );
          }
        },
        onError: this.onError,
        scope: this
      });
    },

    isItem: function(/* anything */ something){
      // summary:
      //    Returns true if the specified item 'something' is a valid store item
      //    or the tree root.
      // tags:
      //    extension

      return (something === this.root) ? true : this.inherited(arguments);
    },

    mayHaveChildren: function(/*dojo.data.Item*/ storeItem){
      // summary:
      //    Tells if an item has or may have children.  Implementing logic here
      //    avoids showing +/- expando icon for nodes that we know don't have children.
      //    (For efficiency reasons we may not want to check if an element actually
      //    has children until user clicks the expando node)
      // tags:
      //    extension
      return storeItem === this.root || this.inherited(arguments);
    },

    newItem: function(/* dojo.dnd.Item */ args, /*Item*/ parent, /*int?*/ insertIndex){
      // summary:
      //    Creates a new item.   See `dojo.data.api.Write` for details on args.
      //    Used in drag & drop when item from external source dropped onto tree.
      // description:
      //    Developers will need to override this method if new items get added
      //    to parents with multiple children attributes, in order to define which
      //    children attribute points to the new item.

      var identity = this._getStoreIdentity(),
          pInfo    = null,
          newItem;

      if(parent !== this.root){
        pInfo = {parent: parent, attribute: this.childrenAttrs[0]};
      } else {
        this.onNewRootItem(args);
      }

      if( identity && args[identity]){
        // Maybe there's already a corresponding item in the store; if so, reuse it.
        this.fetchItemByIdentity(
          { identity: args[identity], 
            onItem: function(item){
              if(item){
                // There's already a matching item in store, use it
                this.pasteItem(item, null, parent, true, insertIndex);
              } else {
                // Create new item in the tree, based on the drag source.
                newItem = this.store.newItem(args, pInfo);
                if(newItem && (insertIndex!=undefined)){
                  // Move new item to desired position
                  this.pasteItem(newItem, parent, parent, false, insertIndex);
                }
              }
            },
            scope: this 
          });
      }
      else  // No identity
      {
        // [as far as we know] there is no id so we must assume this is a new item
        newItem = this.store.newItem(args, pInfo);
        if(newItem && (insertIndex!=undefined)){
          // Move new item to desired position
          this.pasteItem(newItem, parent, parent, false, insertIndex);
        }
        return newItem;
      }
    },

    onAddToRoot: function(/* item */ item){
      // summary:
      //    Called when item added to root of tree; user must override this method
      //    to modify the item so that it matches the query for top level items
      // tags:
      //    extension
      // example:
      //  |  store.setValue(item, "root", true);
      console.log(this, ": item ", item, " added to root");
    },

    onDeleteItem: function (/*Object*/ storeItem){
      // summary:
      //    Handler for delete notifications from the store.  Because all parent
      //    references for the item have already been removed we need to use the
      //    backup list to determine who the parents were and update their checked
      //    state accordingly.
      // storeItem:
      //    The store item that was deleted.

      var backupRef = "backup_" + this.store._reverseRefMap;
          
      if(array.indexOf(this.root.children, storeItem) != -1){
        this._requeryTop();
      }
      this.inherited(arguments);

      this._updateCheckedParent( storeItem, backupRef );
    },

    onError: function (/*Object*/ err ) {
      // summary:
      //    Callback when an error occurred.
      // tags:
      //    callback
      console.err( this, err );
    },
    
    onLeaveRoot: function(/* item */ item){
      // summary:
      //    Called when item removed from root of tree; user must override this method
      //    to modify the item so it doesn't match the query for top level items
      // tags:
      //    extension
      // example:
      //   |  store.unsetAttribute(item, "root");

      console.log(this, ": item ", item, " removed from root");
    },

    onNewItem: function(/* dojo.data.Item */ item, /* Object */ parentInfo){
      // summary:
      //    Handler for when new items appear in the store.  Developers should override this
      //    method to be more efficient based on their app/data.
      // description:
      //    Note that the default implementation requeries the top level items every time
      //    a new item is created, since any new item could be a top level item (even in
      //    addition to being a child of another item, since items can have multiple parents).
      // tags:
      //    extension
      this._requeryTop();

      this._updateCheckedParent( item );
      this.inherited(arguments);
    },

    onNewRootItem: function(/* dojo.dnd.Item */ /*===== args =====*/){
      // summary:
      //    User can override this method to modify a new element that's being
      //    added to the root of the tree, for example to add a flag like root=true
    },

    onSetItem: function(storeItem, attribute, oldValue, newValue ){
      // summary:
      //    Updates the tree view according to changes in the data store.
      // description:
      //    Handles updates to a store item's children by calling onChildrenChange(), and
      //    other updates to a store item by calling onChange().
      // storeItem: 
      //    Store item
      // attribute: 
      //    attribute-name-string
      // oldValue: object | array
      // newValue: object | array
      // tags:
      //    extension
     
      if(array.indexOf(this.childrenAttrs, attribute) != -1){
        // Store item's children list changed
        this.getChildren(storeItem, lang.hitch(this, function(children){
          // See comments in onNewItem() about calling getChildren()
          this.onChildrenChange(storeItem, children);
        }));
      }else{
        if( this._queryAttrs.length && array.indexOf( this._queryAttrs, attribute ) != -1 ) {
          this._requeryTop();
        }
        if( attribute == this.store._labelAttr ) {
          attribute = "label";
        }
        this.onChange(storeItem, attribute, newValue );
      }
    },

    pasteItem: function(/*Item*/ childItem, /*Item*/ oldParentItem, /*Item*/ newParentItem, 
                         /*Boolean*/ bCopy, /*int?*/ insertIndex){
      // summary:
      //    Move or copy an item from one parent item to another.
      //    Used in drag & drop
      // tags:
      //    extension
      if(oldParentItem === this.root){
        if(!bCopy){
          // It's onLeaveRoot()'s responsibility to modify the item so it no longer matches
          // this.query... thus triggering an onChildrenChange() event to notify the Tree
          // that this element is no longer a child of the root node
          this.onLeaveRoot(childItem);
        }
      }
      this.inherited(arguments, [childItem,
        oldParentItem === this.root ? null : oldParentItem,
        newParentItem === this.root ? null : newParentItem,
        bCopy,
        insertIndex
      ]);
      if(newParentItem === this.root){
        // It's onAddToRoot()'s responsibility to modify the item so it matches
        // this.query... thus triggering an onChildrenChange() event to notify the Tree
        // that this element is now a child of the root node
        this.onAddToRoot(childItem);
      }
      this._updateCheckedParent( childItem );
    },

    set: function (/*dojo.data.item*/ storeItem, /*String*/ attr, /*anytype*/ value ) {
      // summary:
      //    Provide the setter capabilities for store items thru the model. The
      //    'set' operates on a store item providing a convenient way to change
      //    store item properties.
      // storeItem:
      //    The store item whose property is to be set.
      // attr:
      //    Property name to set.
      // value:
      //    Value to be applied.
      
      if(this.isItem( storeItem )) {
        var func = this._getFuncNames( attr == this.checkedAttr ? "checked" : attr );
        return this[func.set] ? this[func.set](storeItem, value)
                               : this._setStoreItemAttr( storeItem, attr, value );
      }
      throw new Error("StoreModel:set(): argument is not a valid store item.");
    },
     
    uncheck: function (/*Object|String*/ query, /*Callback*/ onComplete, /*Context*/ scope ) {
      // summary:
      //    Uncheck all store items that match the query.
      // description:
      //    See description _checkOrUncheck()
      //  example:
      //    uncheck( { name: "John" } );
      //  | uncheck( "John", myCallback, this );

      this._checkOrUncheck( query, false, onComplete, scope );
    },

  });  /* end declare() */

});  /* end define() */
