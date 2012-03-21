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
  "dijit/tree/ForestStoreModel",
  "dojo/_base/array",
  "dojo/_base/declare",
  "dojo/_base/lang",
  "dojo/dom-attr"
], function( ForestStoreModel, array, declare, lang, domAttr) {

  return declare( [ForestStoreModel], { 
    // checkboxAll: Boolean
    //    If true, every node in the tree will receive a checkbox regardless if
    //    the 'checked' attribute is specified in the dojo.data.store
    checkboxAll: true,

    // checkboxState: Boolean
    //     The default state applied to every checkbox unless otherwise specified
    //    in the dojo.data.store (see also: checkboxIdent)
    checkboxState: false,

    // checkboxRoot: Boolean
    //    If true, the root node will receive a checkbox eventhough it's not a
    //    true entry in the store. This attribute is independent of the showRoot
    //    attribute of the tree itself. If the tree attribute 'showRoot' is set
    //    to false the checkbox for the root will not show either.  
    checkboxRoot: false,

    // checkboxStrict: Boolean
    //    If true, a strict parent-child checkbox relation is maintained. For 
    //    example, if all children are checked the parent will automatically be
    //    checked or if any of the children are unchecked the parent will be 
    //    unchecked. 
    checkboxStrict: true,

    // checkboxIdent: String
    //    The attribute name (property of the store item) that holds the 'checked'
    //    state. On load it specifies the store items initial checked state.   For
    //    example: { name:'Egypt', type:'country', checked: true } If a store item
    //    has no 'checked' attribute specified it will depend on the model property
    //    'checkboxAll' if one will be created automatically and if so, its initial
    //    state will be set as specified by 'checkboxState'. 
    checkboxIdent: "checked",
    
    // _multiState: Boolean [private]
    //    Determines if the checked state needs to be maintained as multi state or
    //    or as a dual state. ({"mixed",true,false} vs {true,false}).   Note: This
    //    parameter is set by the tree.
    _multiState: true,
    
    _checkOrUncheck: function( /*String|Object*/ query, /*Boolean*/ newState, /*Callback*/ onComplete, 
                                /*Context*/ scope ) {
      // summary:
      //    Check or uncheck the checked state of all store items that match the query.
      // description:
      //    Check or uncheck the checked state of all store items that match the
      //    query. This method is called by either the public methods 'check' or
      //    'uncheck' providing an easy way to programmatically alter the checked
      //    state of a set of checkboxes associated with the tree nodes.
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

      this.getStoreItems( query, function( storeItems ) {
        array.forEach( storeItems, function( storeItem ) {
          if( this.store.getValue( storeItem, this.checkboxIdent) != newState ) {
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

    _getCheckedAttr: function(/*dojo.data.Item*/ storeItem) {
      // summary:
      //    Get the current checked state from the dojo.data.store for the specified
      //    store item. This is the hook for get(item,"checked")
      // description:
      //    Get the current checked state from the dojo.data store. The checked state
      //    in the store can be: 'mixed', true, false or undefined. Undefined in this
      //    context means no checked identifier (checkboxIdent) was found in the store
      //    Depending on the checkbox attributes as specified above the following will
      //    take place:
      //
      //    a)  If the current checked state is undefined and the checkbox attribute
      //        'checkboxAll' or 'checkboxRoot' is true one will be created and the
      //        default state 'checkboxState' will be applied.
      //    b)  If the current state is undefined and 'checkboxAll' is false the state
      //        undefined remains unchanged and is returned. This will prevent a tree
      //        node from creating a checkbox.
      //
      // storeItem:
      //    The item in the dojo.data.store whos checkbox state is returned.
      // example:
      //    var currState = model.get(item,"checked");
      //    
      var checked;
      
      if ( storeItem != this.root ) {
        checked = this.store.getValue(storeItem, this.checkboxIdent);
        if( checked === undefined )
        {
          if( this.checkboxAll) {
            this._setCheckedState( storeItem, this.checkboxState );
            checked = this.checkboxState;
          }
        }
      } 
      else // Fake tree root. (the root is NOT a dojo.data.item).
      {  
        if( this.checkboxRoot )
        {
          checked = this.root.checked;
        }
      }
      return checked;  // the current state of the checkbox (true/false or undefined)
    },

    _getFuncNames: function( /*String*/ name ) {
      // summary:
      //		Helper function for the get() and set() mthods. Returns the function names
      //    in lowerCamelCase for the get and set functions associated with the 'name'
      //    property.
      // name:
      //    Attribute name.
      // tags:
      //		private
      //
      var cc = name.replace(/^[a-z]|-[a-zA-Z]/g, function(c){ return c.charAt(c.length-1).toUpperCase(); });
      var fncSet = { set: "_set"+cc+"Attr", get: "_get"+cc+"Attr" };
      return fncSet;
    },

    _getParentsItem: function(/*dojo.data.Item*/ storeItem ) {
      // summary:
      //    Get the parent(s) of a dojo.data item.  
      // description:
      //    Get the parent(s) of a dojo.data item. The '_reverseRefMap' entry of
      //    the item is used to identify the parent(s). A child will have a parent
      //    reference if the parent specified the '_reference' attribute. 
      //    For example: children:[{_reference:'Mexico'}, {_reference:'Canada'}, ...
      //
      //  storeItem:
      //    The dojo.data.item whos parent(s) will be returned.
      // tags:
      //		private
      //
      var parents = [];

      if( storeItem != this.root ) {
        var references = storeItem[this.store._reverseRefMap];
        for(itemId in references ) {
          parents.push( this.store._getItemByIdentity( itemId ) );
        }
        if (!parents.length) {
          parents.push(this.root);
        }
      }
      return parents // parent(s) of a dojo.data.item (Array of dojo.data.items)
    },

    _getStoreItemAttr: function( /*dojo.data.Item*/ storeItem, /*String*/ attr ) {
      // summary:
      //    Return the attribute value of a dojo.data.store item.  This method
      //    provides the hook for the get(item,attr) method for all store item
      //    attributes other than 'checked'.
      // storeItem:
      //    The item in the dojo.data.store whos attribute value is returned.
      // attr:
      //    Attribute name whos value is returned. 
      return this.store.getValue( storeItem, attr )
    },

   _setCheckedAttr: function(/*dojo.data.Item*/ storeItem, /*Boolean*/ newState ) {
      // summary:
      //    Update the checked state ('mixed'/true/false) for the store item
      //    and the associated parent and child checkboxes, if any. This is
      //    the hook for set(item,"checked",value)
      // description:
      //    Update the checked state for a single store item and the associated
      //    parent and child checkboxes, if any. This method is called from the
      //    tree if the user checked/unchecked a checkbox. The parent and child
      //    tree nodes are updated to maintain consistency if 'checkboxStrict'
      //    is set to true. Use the public API set() to change the checked state
      //    programmatically.
      //  storeItem:
      //    The item in the dojo.data.store whos checked state needs updating.
      //  newState:
      //    The new checked state: 'mixed', true or false
      //  example:
      //    model.set( item,"checked",newState );
      
      if( !this.checkboxStrict ) {
        this._setCheckedState( storeItem, newState );    // Just update the checkbox state
      } else {
        this._updateChildCheckBox( storeItem, newState ); // Update children and parent(s).
      }
    },

    _setCheckedState: function(/*dojo.data.Item*/ storeItem, /*Boolean|String*/ newState ) {
      // summary:
      //    Set/update the checked state on the dojo.data store. Returns true if
      //    the checked state changed otherwise false.
      // description:
      //    Set/update the checked state on the dojo.data.store.  Retreive the
      //    current checked state  and validate if an update is required, this 
      //    will keep store updates to a minimum. If the current checked state
      //    is undefined (ie: no checked attribute specified in the store) the 
      //    'checkboxAll' attribute is tested to see if a checkbox needs to be
      //    created.  In case of the root node the 'checkboxRoot' attribute is
      //    checked.
      //
      //    NOTE: The store.setValue() method will add the attribute for the
      //          item if none exists.   
      //
      //  storeItem:
      //    The item in the dojo.data.store whos checked state is updated.
      //  newState:
      //    The new checked state: 'mixed', true or false.
      //  tag:
      //    private
      //
      var stateChanged = true;
          
      // Normalize newState first so we don't store garbage...
      if( newState !== "mixed" || !this._multiState ) {
        newState = newState ? true : false;
      } 
      if( storeItem != this.root ) {
        var currState = this.store.getValue(storeItem, this.checkboxIdent);
        if( (currState !== undefined || this.checkboxAll) && (currState != newState ) ) {
          this.store.setValue( storeItem, this.checkboxIdent, newState );
        } else {
          stateChanged = false;
        }
      } 
      else   // Tree root instance
      {
        if( this.checkboxRoot && ( this.root.checked != newState ) ) {
          this.root.checked = newState;
        } else {
          stateChanged = false;
        }
      }
      return stateChanged;
    },

    _setStoreItemAttr: function( /*dojo.data.Item*/ storeItem, /*String*/ attr, /*AnyType*/ value ) {
      // summary:
      //    Hook for the set(item,attr,value) method for all attributes other than
      //    'checked'.
      //  storeItem:
      //    The item in the dojo.data.store whos attribute value will be updated.
      // attr:
      //    Attribute name whos value is being updated. 
      //  value:
      //    The new value to be applied to the attribute.
      //
      if( attr == this.store._getIdentifierAttribute() ) {
        throw new Error("cbtree: identifier attribute: {" + attr + "} can not be changed.");
      }
      return this.store.setValue( storeItem, attr, value );
    },

    _updateChildCheckBox: function(/*dojo.data.Item*/ storeItem, /*Boolean*/ newState ) {
      //  summary:
      //    Set the parent (the storeItem) and all child checkboxes to true/false
      //  description:
      //    If a parent checked state changed, all child and grandchild checkboxes
      //    will be updated to reflect the change. For example, if the parent state
      //    is set to true, all child and grandchild checkboxes will receive that
      //    same 'true' state. If a child checkbox changed state all of its parents
      //    need to be re-evaluated.
      //
      //  storeItem:
      //    The parent dojo.data.item whos child/grandchild checkboxes require
      //    updating.
      //  newState:
      //    The new state of the checkbox: true or false
      //  tag:
      //    private

      if( this.mayHaveChildren( storeItem )) {
        this.getChildren( storeItem, lang.hitch( this,
          function( children ) {
            array.forEach( children, function(child) {
              this._updateChildCheckBox( child, newState );
            }, this );          
          }),
          function(err) {
            console.error(this, ": updating child checkboxes: ", err);
          });
      } else {
        if( this._setCheckedState( storeItem, newState ) ) {
          this._updateParentCheckBox( storeItem );
        }
      }
    },

    _updateParentCheckBox: function(/*dojo.data.Item*/ storeItem ) {
      //  summary:
      //    Update the parent checked state according to the state of all child
      //    checked states.
      //  description:
      //    Update the parent checked state according to the state of all of its
      //    child checkboxes. The parent checkbox automatically changes state if 
      //    ALL child checkboxes are true or false.  If, as a result, the parent
      //    checked state changed, we check if its parent needs updating as well
      //    all the way upto the root. 
      //
      //    NOTE: If any of the children has a mixed state, the parent will
      //          also get a mixed state.
      //
      //  storeItem:
      //    The dojo.data.item whos parent checkboxes require updating.
      //  tag:
      //    private
      var parents = this._getParentsItem( storeItem );
      array.forEach( parents, function( parentItem ) {
        this.getChildren( parentItem, lang.hitch( this,
          function(children) {
            var hasChecked   = false,
                hasUnChecked = false,
                isMixed      = false;
            array.some( children, function(child) {
              state = this._getCheckedAttr(child);
              isMixed |= ( state == "mixed" );
              switch( state ) {  // ignore 'undefined' state
                case true:
                  hasChecked = true;
                  break;
                case false: 
                  hasUnChecked = true;
                  break;
              }
              return isMixed;
            }, this );
            isMixed |= !(hasChecked ^ hasUnChecked);
            if( this._setCheckedState( parentItem,  isMixed ? "mixed" : hasChecked ? true: false ) ) {
              this._updateParentCheckBox( parentItem );
            }
          }),
          function(err) {
            console.error(this, ": fetching mixed state: ", err);
          });
      }, this ); /* end forEach() */
    },
    
    _validateData: function(/*dojo.data.Item*/ storeItem, /*Context*/ scope ) {
      // summary:
      //    Validate/normalize the parent-child checkbox relationship if the
      //    attribute 'checkboxStrict' is set to true. This method is called
      //    as part of the post creation of the Tree instance. First we try a
      //    forced synchronous load of the Json datafile dramatically improving
      //    the startup time.
      //  storeItem:
      //    The element to start traversing the dojo.data.store, typically the
      //    (fake) tree root.
      //  scope:
      //    The scope to use when executing this method.

      if( scope.checkboxStrict ) {
        try {
          scope.store._forceLoad();    // Try a forced synchronous load
        } catch(e) { 
          console.log(e);
        }
        lang.hitch( scope, scope._validateStore ) ( storeItem ); 
      }
    },

    _validateStore: function(/*dojo.data.Item*/ storeItem ) {
      // summary:
      //    Validate/normalize the parent(s) checkbox data in the dojo.data store.
      // description:
      //    All parent checkboxes are set to the appropriate state according to the
      //    actual state(s) of their children. This will potentionally overwrite
      //    whatever was specified for the parent in the dojo.data store. This will
      //    garantee the tree is in a consistent state after startup. 
      //  storeItem:
      //    The element to start traversing the dojo.data.store, typically model.root
      //  example:
      //  | this._validateStore( storeItem );
      //
      this.getChildren( storeItem, lang.hitch( this,
        function(children) {
          var hasGrandChild = false,
            oneChild    = null;          
          array.forEach( children, function( child ) {
            if( this.mayHaveChildren( child )) {
              this._validateStore( child );
              hasGrandChild = true;
            } else {
              oneChild = child;
            }
          },this );
          if( !hasGrandChild && oneChild ) {  // Found a child on the lowest branches ?
            this._updateParentCheckBox( oneChild );
          }
        }),
        function(err) {
          console.error(this, ": validating checkbox data: ", err);
        } 
      );
    },

    check: function( /*Object|String*/ query, /*Callback*/ onComplete, /*Context*/ scope ) {
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

    constructor: function(/*Object*/ params){
      // summary:
      //		Create the dummy root.
      // description:
      //    Create the dummy root and set the initial checked state for the
      //    tree root.
      // tags:
      //		private

      // Make dummy root item
      this.root = {
        store: this,
        root: true,
        checked: this.checkboxState,
        id: params.rootId,
        label: params.rootLabel,
        children: params.rootChildren	// optional param
      };
    },

    get: function( /*dojo.data.Item*/ storeItem , /*String*/ attr){
      // summary:
      //    Provide the getter capabilities for store items thru the model.  The
      //    'get' operates on a store item providing a convenient way to get any
      //    store item properties.
      //
      //    Note: All checkbox related events from the tree will pass a store
      //          item as an argument.
      //
      // storeItem:
      //    The store item whos property to get.
      // attr:
      //    Name of property to get

      var func = this._getFuncNames( attr );
      return this[func.get] ? this[func.get](storeItem) : this._getStoreItemAttr( storeItem, attr );
    },

    getStoreItems: function( /* String|Object */ query, /* Callback */ onComplete, /* Context */ scope ) {
      // summary:
      //    Get the list of store items that match the query and have a checkbox.
      // description:
      //    Get the list of store items that match the query and have a checkbox.
      //    This method provides a simplified interface to the fetch() method.
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
      //
      var  checkBoxes = [],
        storeQuery = {};
        
      if(typeof query == "string"){
        storeQuery[ this.store.getLabelAttributes() ] = query;
      } else {
        storeQuery = query;
      }
      
      this.store.fetch(  {  
        query: storeQuery,
        onItem: function( storeItem, request ) {
          // Make sure the item has the appropriate attribute so we don't inadvertently
          // start adding checkboxes.
          if( this.store.hasAttribute( storeItem, this.checkboxIdent )) {
            checkBoxes.push( storeItem );
          }
        },
        onComplete: function( storeItems, request ) {
          if( onComplete ) {
            onComplete.call( (scope ? scope : this ), checkBoxes );
          }
        },
        onError: function( err, request ) {
          console.error(this, ": fetching data: ", err);
        },
        scope: this
      });
    },

    set: function( /*dojo.data.storeItem*/ storeItem, /*String*/ attr, /*anytype*/ value ) {
      // summary:
      //    Provide the setter capabilities for store items thru the model. The
      //    'set' operates on a store item providing a convenient way to change
      //    store item properties.
      //
      //    Note: All checkbox related events from the tree will pass a store
      //          item as an argument.
      //
      // storeItem:
      //    The store item whos property is to be set.
      // attr:
      //    Property name to set.
      // value:
      //    Value to be applied.
      
      var func = this._getFuncNames( attr );
      return this[func.set] ? this[func.set](storeItem, value)
                             : this._setStorestoreItemAttr( storeItem, attr, value );
    },
     
    uncheck: function( /*Object|String*/ query, /*Callback*/ onComplete, /*Context*/ scope ) {
      // summary:
      //    Uncheck all store items that match the query.
      // description:
      //    See description _checkOrUncheck()
      //  example:
      //    model.uncheck( { name: "John" } );
      //    model.uncheck( "John", myCallback, this );

      this._checkOrUncheck( query, false, onComplete, scope );
    }
    
  });  /* end declare() */

});  /* end define() */
