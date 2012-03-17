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

  return declare( [ForestStoreModel ], { 
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
    //    The attribute name (attribute of the dojo.data.item) that specifies the
    //    items checkbox initial state. Example: { name:'Egypt', type:'country', 
    //    checked: true } If a dojo.data.item has no 'checked' attribute specified
    //    it will depend on the attribute 'checkboxAll' if one will be created 
    //    automatically and if so, its initial state will be set as specified by 
    //    'checkboxState'. 
    checkboxIdent: "checked",
    
    // _validating: [private] number
    //    Indicates if store validation is ongoing. Whenever the store is being
    //    validated, which happens BEFORE the tree is actually rendered, there is
    //    no need to trigger any onCheckboxChange events as there are no tree
    //    nodes and thus no checkboxes improving startup performance. 
    //
    //    Note: _validating is a counter as method _validateStore() calls
    //          itself recursively. Only if it drops back down to zero do
    //          we need to start issuing onCheckboxChange events.
    //      
    _validating: 0,
    
    _checkOrUncheck: function( /* String|Object */ query, /* Boolean */ newState, /* Callback */ onComplete, 
                  /* Context */ scope ) {
      // summary:
      //    Check or uncheck the checked state of all store items that match the query.
      // description:
      //    Check or uncheck the checked state of all store items that match the
      //    query. This method is called by either the public methods 'check' or
      //    'uncheck' providing an easy way to programmatically alter the checked
      //    state of any checkbox associated with the tree nodes.
      //   query:
      //    A query object or string. If query is a string the label attribute of
      //    the store is used as the query attribute and the query string assigned
      //    as the associated value.
      //  newState:
      //    New state to be applied to the store item checkbox state.
      //  onComplete:
      //    If an onComplete callback function is provided, the callback function
      //    will be called just once, after the last storeItem has been updated as: 
      //    onComplete( matches, updates ).
      //  scope:
      //    If a scope object is provided, the function onComplete will be invoked
      //    in the context of the scope object. In the body of the callback function,
      //    the value of the "this" keyword will be the scope object. If no scope is
      //    is provided, onComplete will be called in the context of tree.model.
      //
      var matches = 0,
          updates = 0;

      this.getCheckbox( query, function( storeItems ) {
        array.forEach( storeItems, function( storeItem ) {
          if( this.store.getValue( storeItem, this.checkboxIdent) != newState ) {
            this.updateCheckbox( storeItem, newState );
            updates += 1; 
          }
          matches += 1;
        }, this )
        if( onComplete ) {
          onComplete.call( (scope ? scope : this ), matches, updates );
        }
      }, this );
    },

    _getCheckboxState: function(/*dojo.data.Item*/ storeItem) {
      // summary:
      //    Get the current checkbox state from the dojo.data.store.
      // description:
      //    Get the current checkbox state from the dojo.data store. A checkbox can
      //    have three different states: true, false or undefined. Undefined in this
      //    context means no checkbox identifier (checkboxIdent) was found in the 
      //    dojo.data store. Depending on the checkbox attributes as specified above
      //    the following will take place:
      //
      //    a)  If the current checkbox state is undefined and the checkbox attribute
      //        'checkboxAll' or 'checkboxRoot' is true one will be created and the
      //        default state 'checkboxState' will be applied.
      //    b)  If the current state is undefined and 'checkboxAll' is false the state
      //        undefined remains unchanged and is returned. This will prevent any tree
      //        node from creating a checkbox.
      //
      //  storeItem:
      //    The item in the dojo.data.store whos checkbox state is returned.
      //  example:
      //    var currState = model._getCheckboxState(item);
      //    
      var checked;
      
      if ( storeItem != this.root ) {
        if( this.store.hasAttribute( storeItem, this.checkboxIdent )) {
          checked = this.store.getValue(storeItem, this.checkboxIdent);
        }  
        else  // Attribute missing
        {
          if( this.checkboxAll) {
            this._setCheckboxState( storeItem, this.checkboxState );
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

    _getParentsItem: function(/*dojo.data.Item*/ storeItem ) {
      // summary:
      //    Get the parent(s) of a dojo.data item.  
      // description:
      //    Get the parent(s) of a dojo.data item. The '_reverseRefMap' entry of
      //    the item is used to identify the parent(s). A child will have a parent
      //    reference if the parent specified the '_reference' attribute. 
      //    For example: children:[{_reference:'Mexico'}, {_reference:'Canada'}, ...
      //  storeItem:
      //    The dojo.data.item whos parent(s) will be returned.
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

    _setCheckboxState: function(/*dojo.data.Item*/ storeItem, /*Boolean*/ newState ) {
      // summary:
      //    Set/update (stores) the checkbox state on the dojo.data store.
      // description:
      //    Set/update the checkbox state on the dojo.data.store. Retreive the
      //    current state of the checkbox and validate if an update is required,
      //    this will keep update events to a minimum.
      //    On completion a 'onCheckboxChange' event is triggered if required. 
      //    If the current state is undefined (ie: no checkbox attribute specified
      //    for this dojo.data.item) the 'checkboxAll' attribute is checked  to see
      //    if one needs to be created. In case of the root the 'checkboxRoot' 
      //    attribute is checked.
      //
      //    NOTE: The store.setValue function will create the 'checked' attribute
      //          for the item if none exists.   
      //  storeItem:
      //    The item in the dojo.data.store whos checkbox state is updated.
      //  newState:
      //    The new state of the checkbox: true, false or 'mixed'.
      //  example:
      //    model.setCheckboxState(item, true);
      //
      var stateChanged = true;

      if( storeItem != this.root ) {
        var currState = this.store.getValue(storeItem, this.checkboxIdent);
        if( (currState !== undefined || this.checkboxAll) && (currState != newState ) ) {
          this.store.setValue(storeItem, this.checkboxIdent, newState);
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
      // In case of any changes trigger the update event but only if we're not validating the store.
      if( stateChanged && !this._validating ) {
        this.onCheckboxChange(storeItem, newState);
      }
      return stateChanged;
    },

    _updateChildCheckbox: function(/*dojo.data.Item*/ storeItem, /*Boolean*/ newState ) {
      //  summary:
      //    Set the parent (storeItem) and all child checkboxes to true/false
      //  description:
      //    If a parent checkbox changes state, all child and grandchild checkboxes
      //    will be updated to reflect the change. For example, if the parent state
      //    is set to true, all child and grandchild checkboxes will receive that
      //    same 'true' state. If a child checkbox changes state all of its parents
      //    need to be re-evaluated.
      //  storeItem:
      //    The parent dojo.data.item whos child/grandchild checkboxes require updating.
      //  newState:
      //    The new state of the checkbox: true or false

      if( this.mayHaveChildren( storeItem )) {
        this.getChildren( storeItem, lang.hitch( this,
          function( children ) {
            array.forEach( children, function(child) {
              this._updateChildCheckbox( child, newState );
            }, this );          
          }),
          function(err) {
            console.error(this, ": updating child checkboxes: ", err);
          });
      } else {
        if( this._setCheckboxState( storeItem, newState ) ) {
          this._updateParentCheckbox( storeItem );
        }
      }
    },

    _updateParentCheckbox: function(/*dojo.data.Item*/ storeItem ) {
      //  summary:
      //    Update the parent checkbox states depending on the state of all child
      //    checkboxes.
      //  description:
      //    Update the parent checkbox state depending on the state of all of its
      //    child checkboxes. The parent checkbox automatically changes state if 
      //    ALL child checkboxes are true or false.  If, as a result, the parent
      //    checkbox changes state, we check if its parent needs to be updated as
      //    well, all the way upto the root. 
      //
      //    NOTE: If any of the children have a mixed state, the parent will
      //          automatically get a mixed state too.
      //  storeItem:
      //    The dojo.data.item whos parent checkboxes require updating.
      //
      var parents = this._getParentsItem( storeItem );
      array.forEach( parents, function( parentItem ) {
        this.getChildren( parentItem, lang.hitch( this,
          function(children) {
            var hasChecked   = false,
                hasUnChecked = false,
                isMixed      = false;
            array.some( children, function(child) {
              state = this._getCheckboxState(child);
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
            // If the parent has a mixed state its checked state is always true.
            if( this._setCheckboxState( parentItem,  isMixed ? "mixed" : hasChecked ? true: false ) ) {
              this._updateParentCheckbox( parentItem );
            }
          }),
          function(err) {
            console.error(this, ": fetching mixed state: ", err);
          });
      }, this );
    },
    
    _validateData: function(/*dojo.data.Item*/ storeItem, /*thisObject*/ scope ) {
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
          this._validating += 1;
          array.forEach( children, function( child ) {
            if( this.mayHaveChildren( child )) {
              this._validateStore( child );
              hasGrandChild = true;
            } else {
              oneChild = child;
            }
          },this );
          if( !hasGrandChild && oneChild ) {  // Found a child on the lowest branches ?
            this._updateParentCheckbox( oneChild );
          }
          this._validating -= 1;
        }),
        function(err) {
          console.error(this, ": validating checkbox data: ", err);
          this._validating = 0;
        } 
      );
    },

    check: function( query, onComplete, scope ) {
      // summary:
      //    Check all store items that match the query.
      // description:
      //    See description _checkOrUncheck()
      //  example:
      //    model.check( { name: "John" } ); or model.check( "John", myCallback, this );

      this._checkOrUncheck( query, true, onComplete, scope );
    },

    constructor: function(params){
      // summary:
      //		Create the dummy root.
      // description:
      //    Create the dummy root and set the initial checked state for the tree root.
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

   getCheckbox: function( /* String|Object */ query, /* Callback */ onComplete, /* Context */ scope ) {
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

    onCheckboxChange: function(/*dojo.data.Item*/ storeItem ) {
      // summary:
      //    Callback whenever a checkbox state has changed state, so that 
      //    the Tree can update the checkbox.  This callback is generally
      //    triggered by the '_setCheckboxState' function. 
      // tags:
      //    callback
    },
      
    uncheck: function( query, onComplete, scope ) {
      // summary:
      //    Uncheck all store items that match the query.
      // description:
      //    See description _checkOrUncheck()
      //  example:
      //    model.uncheck( { name: "John" } );
      //    model.uncheck( "John", myCallback, this );

      this._checkOrUncheck( query, false, onComplete, scope );
    },
    
    updateCheckbox: function(/*dojo.data.Item*/ storeItem, /*Boolean*/ newState ) {
      // summary:
      //    Update the checkbox state (true/false) for the store item and the
      //    associated parent and child checkboxes, if any. 
      // description:
      //    Update a single checkbox state (true/false) for the store item and
      //    the associated parent and child checkboxes, if any. This method is
      //    called from the tree if a user checked or unchecked a checkbox on
      //    the tree or can be called programmatically.  The parent and child
      //    tree nodes are updated to maintain consistency if 'checkboxStrict'
      //    is set to true.
      //  storeItem:
      //    The item in the dojo.data.store whos checkbox state needs updating.
      //  newState:
      //    The new state of the checkbox: true or false
      //  example:
      //    model.updateCheckboxState(item, true);
      //
      if( !this.checkboxStrict ) {
        this._setCheckboxState( storeItem, newState );    // Just update the checkbox state
      } else {
        this._updateChildCheckbox( storeItem, newState ); // Update children and parent(s).
      }
    }

  });  /* end declare() */

});  /* end define() */
