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
  "dojo/_base/array",
  "dojo/_base/declare",
  "dojo/_base/event",
  "dojo/_base/window",
  "dojo/dom-attr",
  "dojo/dom-class",
  "dojo/dom-construct",
  "dojo/dom-style",
  "dojo/text!./templates/cbtreeNode.html",
  "dijit/registry",
  "dijit/Tree",
  "./CheckBox",
  "./StoreModel"
], function( array, declare, event, win, domAttr, domClass, domConstruct, domStyle, 
              cbtreeNodeTemplate, registry, Tree, CheckBox, StoreModel ) {

  var TreeNode = declare([dijit._TreeNode], {
    // _checkbox: [protected] dojo.doc.element
    //    Local reference to the dojo.doc.element of type 'checkbox'
    _checkbox: null,

    // templateString: String
    //    Specifies the HTML template to be used.
    templateString: cbtreeNodeTemplate,

    _applyClassAndStyle: function(item, lower, upper){
      // summary:
      //		Set the appropriate CSS classes and styles for labels, icons and rows.
      //    This local implementation passed the indent level as an extra argument.
      // item:
      //		The data item.
      // lower:
      //		The lower case attribute to use, e.g. 'icon', 'label' or 'row'.
      // upper:
      //		The upper case attribute to use, e.g. 'Icon', 'Label' or 'Row'.
      // tags:
      //		private

      var clsName = "_" + lower + "Class";
      var nodeName = lower + "Node";
      var oldCls = this[clsName];

      this[clsName] = this.tree["get" + upper + "Class"](item, this.isExpanded, this.indent);
      domClass.replace(this[nodeName], this[clsName] || "", oldCls || "");

      domStyle.set(this[nodeName], this.tree["get" + upper + "Style"](item, this.isExpanded) || {});
    },

    _createCheckBox: function() {
      // summary:
      //    Create a checkbox on the cbtreeTreeNode if a checkbox style is specified.
      // description:
      //    Create a checkbox on the cbtreeTreeNode. A checkbox is ONLY if the checkbox
      //    style of the tree isn't "none" AND a valid 'checked' attribute was found
      //    in the dojo.data store OR the attribute 'checkboxAll' equals true. 
      //    If the 'checked' property of the state is undefined no reference was
      //    found and if 'checkboxAll' is false no checkbox will be created.
      //
      //  NOTE: The attribute 'checkboxAll' is validated by getCheckBoxState(),
      //        therefore no need to do it here.
      //    
      if( this.tree.checkboxStyle !== "none" )
      {
        var  checked = this.tree.model._getCheckedAttr( this.item );
 
        if( checked !== undefined ) {
          switch( this.tree.checkboxStyle ) {
            case "dijit":
              this._checkbox = new CheckBox({ 
                                  multiState: this.tree.checkboxMultiState,
                                  checked: checked,
                                  value: this.label }
                                );
              domConstruct.place(this._checkbox.domNode, this.checkBoxNode, 'replace');
              break;
              
            case "HTML":
              this._checkbox = win.doc.createElement('input');
              
              domAttr.set( this._checkbox, "className", "cbtreeHTMLCheckBox" );
              domAttr.set( this._checkbox, "type", "checkbox" );
              domAttr.set( this._checkbox, "value", this.label );

              this._setCheckBoxState( checked );
              domConstruct.place(this._checkbox, this.checkBoxNode, 'replace');
              break;
          }
        }
      }
      // If no branch or leaf icons are required use the display style to hide them
      // as not all browsers support the 'hidden' property for the iconNode.
      if( this.isExpandable ) {
        if ( this.tree.branchReadOnly ) {
          this._checkbox.readOnly = true;
        }
        if ( !this.tree.branchIcons ) {
          domStyle.set( this.iconNode, "display", "none" );
        }
      } else {
        if( !this.tree.nodeIcons ) {
          domStyle.set( this.iconNode, "display", "none" );
        }
      }
    },
    
    _onClick: function( /*Event*/ evt){
      // summary:
      //		Handler for onclick event on a tree node
      // description:
      //    If the click event occured on a checkbox, intercept it and go update
      //    the store and generate the checkbox click related events otherwise
      //    pass the event on to the tree as a regular click event.
      // tags:
      //		private

      if(evt.target.nodeName == 'INPUT') {
        var newState = this._getCheckedAttr();
        this.tree.model._setCheckedAttr( this.item, newState ); 
        this.tree._onCheckBoxClick( this, newState, evt );
      } else {
        this.tree._onClick(this, evt);
      }
    },

    _setCheckBoxState: function( /*Boolean*/ newState ) {
      // summary:
      //    Update the 'checked' state of a HTML or dijit checkbox.
      // description:
      //    Update the checkbox 'checked' state. In case of a HTML checkbox the
      //    checked state can only be 'true' or 'false', an additional attribute
      //    'mixed' is used to store the mixed state. 
      //    The visual aspect of a mixed checkbox state is only supported when
      //    using the dijit style checkbox (default).
      //
      //  newState:
      //    The new checkbox state which can be either true, false or 'mixed'.
      //
      switch( this.tree.checkboxStyle ) {
        case "dijit":
          this._checkbox._setCheckedAttr( newState );
          break;
        case "HTML":
          if( this.tree.checkboxMultiState ) {
            domAttr.set( this._checkbox, "mixed", ( newState == "mixed" ? true : false) );
          }
          domAttr.set( this._checkbox, "checked", ( newState ? true : false) );
          break;
      }
    },

    _getCheckedAttr: function() {
      // summery:
      //    Get the current checked state of the checkbox. Provide the hook for
      //    get("checked")
      // description:
      //    Get the current checked state of the checkbox. It returns either 'mixed',
      //    true or false. 
      //
      var checked;
      if( this._checkbox ) {
        checked = this._checkbox.checked;
      }
      return checked;
    },
    
    _setCheckedAttr: function( /*Boolean|String)*/ newState ) {
      // summery:
      //    Set the new checked state of the checkbox. Provide the hook for
      //    set("checked",newValue)
      // description:
      //    Set the new checked state of the checkbox.
      //
      if( this._checkbox ) {
        this.tree.model._setCheckedAttr( this.item, newState );
      }
    },
    
    postCreate: function() {
      // summary:
      //    Handle the creation of the checkbox after the cbtreeTreeNode has been
      //    instanciated.
      // description:
      //    Handle the creation of the checkbox after the cbtreeTreeNode has been
      //    instanciated. If a customIcons was specified for the tree, set it now
      //    and remove the default 'dijit' classes. (see template).
      //
      if( this.tree.customIcons )
      {
        domClass.replace( this.iconNode, this.tree.customIcons.cssClass, "dijitIcon dijitTreeIcon" );
      }
      this._createCheckBox();
      this.inherited( arguments );
    }
  });  /* end declare() _TreeNode*/


  return declare( [Tree], {
    // checkboxStyle: String
    //    Sets the style of the checkbox to be used. The default is "dijit"
    //    anything else will force the use of the native HTML style checkbox.
    //    The visual representation of a mixed state checkbox is only supported
    //    with a dijit style checkbox. 
    checkboxStyle: "dijit",

    // checkboxMultiState: Boolean
    //    Determines if Multi State checkbox behaviour is required, default is true.
    //    If set to false the value attribute of a checkbox will only be 'checked'
    //    or 'unchecked'. If true the value can be 'checked', 'unchecked' or 'mixed'
    checkboxMultiState: true,

    // customIcons: Boolean
    //    If customIcons is true the default dijit icons 'Open' 'Closed' and 'Leaf'
    //    will be replaced by a custom icon strip with three distinct css classes: 
    //    'Expanded', 'Collapsed' and 'Terminal'.
    customIcons: null,
    
    // branchIcons: Boolean
    //    Determines if the FolderOpen/FolderClosed icon is displayed.
    branchIcons: true,

    // branchReadOnly: Boolean
    //    Determines if branch checkboxes are read only. If true, the user must
    //    check/uncheck every child checkbox individually. 
    branchReadOnly: false,
    
    // nodeIcons: Boolean
    //    Determines if the Leaf icon is displayed.
    nodeIcons: true,

    _createTreeNode: function( args ) {
      // summary:
      //    Create a new cbtreeTreeNode instance.
      // description:
      //    Create a new cbtreeTreeNode instance.
      return new TreeNode( args );
    },

    _onCheckBoxChange: function(/*dojo.data.Item*/ storeItem ) {
      // summary:
      //    Process notification of a change to a checkbox state (triggered
      //    by the model).
      // description:
      //    Whenever the model changes the state of a checkbox in the dojo.data
      //    store it will trigger the 'onCheckBoxChange' event allowing the Tree
      //    to make the same changes on the tree Node. There is a condition however
      //    when we get a checkbox update but the associated tree node does not
      //    exist:
      //    -  The node has not been created yet because the user has not
      //      expanded the tree/branch or the initial data validation
      //      triggered the update in which case there are no tree nodes
      //      at all.
      // tags:
      //    callback

      var model   = this.model,
          state    = model._getCheckedAttr( storeItem ),
          identity = model.getIdentity(storeItem),
          nodes    = this._itemNodesMap[identity];
    
      // As of dijit.Tree 1.4 multiple references (parents) are supported,
      // therefore we may have to update multiple tree nodes which are all
      // associated with the same dojo.data.item.
      if( nodes ) {
        array.forEach( nodes, function(node) {
          if( node._checkbox != null )
            node._setCheckBoxState( state );
        }, this );
      }
    }, 

    _onCheckBoxClick: function(/*TreeNode*/ nodeWidget, /*Boolean|String*/ newState, /*Event*/ e) {
      // summary:
      //    Translates click events into commands for the controller to
      //    process.
      // description:
      //    the _onCheckBoxClick function is called whenever a mouse 'click'
      //    on a checkbox is detected. Because the click was on the checkbox
      //    we are not handling any node expansion or collapsing here.
      //
      var storeItem = nodeWidget.item;
        
      this._publish("execute", { item: storeItem, node: nodeWidget, evt: e} );
      // Generate events incase any listeners are tuned in...
      this.onCheckBoxClick( storeItem, nodeWidget, e );
      if( newState ) {
        this.onCheckBoxChecked( storeItem, nodeWidget, e);
      } else {
        this.onCheckBoxUnchecked( storeItem, nodeWidget, e);
      }
      this.onClick(nodeWidget.item, nodeWidget, e);
      this.focusNode(nodeWidget);

      if( this.checkboxStyle != "HTML" ) {
        event.stop(e);
      }
    },
    
    _onKeyPress: function(/*Event*/ e){
      // summary:
      //    Toggle the checkbox state when the user pressed the spacebar.
      // description:
      //    Toggle the checkbox state when the user pressed the spacebar.
      //    The spacebar is only processed if the widget that has focus is
      //    a tree node and has a checkbox.
      //
      if( !e.altKey ) {
        var treeNode = registry.getEnclosingWidget(e.target);
        if( treeNode && treeNode._checkbox != null ) {
          if( (typeof e.charOrCode == "string") && (e.charOrCode == " ") ) {
            this.model._toggleCheckedState( treeNode.item );
          }
        }
      }
      this.inherited(arguments);  /* Pass it on to the parent tree... */
    },

    getIconClass: function(/*dojo.data.Item*/ item, /*Boolean*/ opened, /*Numeric*/ indent ){
      // summary:
      //    Return the css class(es) for the node Icon. 
      // description:
      //    Return the css class(es) for the node Icon. If custom icons are enabled,
      //    the base class returned is either: 'Expanded', 'Collapsed' or 'Terminal'
      //    prefixed with the custom icon class. If custom icon indentation is true
      //    an additional class is returned which is the base class suffixed with 
      //    the current indent level. If custom icons are disabled the default dijit
      //    css class is returned. 
      //
      var iconClass;
      
      if( this.customIcons ) {
        if (!item || this.model.mayHaveChildren(item)) {
          iconClass = (opened ? this.customIcons.cssClass + "Expanded" 
                              : this.customIcons.cssClass + "Collapsed");
        } else {
          iconClass = this.customIcons.cssClass + "Terminal";
        }
        if( this.customIcons.indent === true ) {
          return ( iconClass + ' ' + iconClass + '_' + indent );
        }
        return iconClass;
      }
      return this.inherited(arguments);
    },

    onCheckBoxChecked: function(/*dojo.data.Item*/ storeItem, /*treeNode*/ treeNode, /*Event*/ e) {
      // summary:
      //    Callback when a checkbox on a tree node is checked
      // tags:
      //    callback
    },
    
    onCheckBoxClick: function( /*dojo.data.Item*/ storeItem, /*treeNode*/ treeNode, /*Event*/ e) {
      // summary:
      //    Callback when a checkbox on a tree node is clicked
      // tags:
      //    callback
    },
    
    onCheckBoxUnchecked: function(/*dojo.data.Item*/ storeItem, /*treeNode*/ treeNode, /*Event*/ e) {
      // summary:
      //    Callback when a checkbox tree node is unchecked
      // tags:
      //    callback
    },
    
    postCreate: function() {
      // summary:
      //    Handle any specifics related to the tree and model after the
      //    instanciationof the Tree. 
      // description:
      //    Whenever checkboxes are requested Validate if we have a 'write'
      //    store first. Subscribe to the 'onCheckBoxChange' event (triggered
      //    by the model) and kickoff the initial checkbox data validation.
      //
      var store = this.model.store;

      if( this.checkboxStyle !== "none" ) {
        if(!store.getFeatures()['dojo.data.api.Write']){
          throw new Error("cbtree: store must support dojo.data.Write");
        }
        if( this.customIcons && typeof this.customIcons != "object" ) {        
          if ( (typeof this.customIcons == "string") && this.customIcons.length ) {
            this.customIcons = { cssClass: this.customIcons, indent: true };
          } else {
            throw new Error("cbtree: customIcons must be an object or string");
            this.customIcons = null;
          }
        }
        this.connect(this.model, "onCheckBoxChange", "_onCheckBoxChange");
        this.model._multiState = this.checkboxMultiState;
        this.model._validateData( this.model.root, this.model );
      }
      this.inherited(arguments);
    }
  });  /* end declare() Tree */

});  /* end define() */
