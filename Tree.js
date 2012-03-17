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

    _createCheckbox: function() {
      // summary:
      //    Create a checkbox on the cbtreeTreeNode if a checkbox style is specified.
      // description:
      //    Create a checkbox on the cbtreeTreeNode. A checkbox is ONLY if the checkbox
      //    style of the tree isn't "none" AND a valid 'checked' attribute was found
      //    in the dojo.data store OR the attribute 'checkboxAll' equals true. 
      //    If the 'checked' property of the state is undefined no reference was
      //    found and if 'checkboxAll' is false no checkbox will be created.
      //
      //  NOTE: The attribute 'checkboxAll' is validated by _getCheckboxState(),
      //        therefore no need to do it here.
      //    
      if( this.tree.checkboxStyle !== "none" )
      {
        var  checked = this.tree.model._getCheckboxState( this.item );
 
        if( checked !== undefined ) {
          switch( this.tree.checkboxStyle ) {
            case "dijit":
              this._checkbox = new CheckBox({ 
                                  multiState: this.tree.checkboxMultiState,
                                  checked: checked,
                                  label: this.label }
                                );
              domConstruct.place(this._checkbox.domNode, this.checkBoxNode, 'replace');
              break;
              
            case "HTML":
              this._checkbox = win.doc.createElement('input');
              this._checkbox.className = 'cbtreeHTMLCheckBox';
              this._checkbox.type      = 'checkbox';
              
              this._setCheckedState( checked );
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
    
    _setCheckedState: function( /*Boolean*/ checked ) {
      // summary:
      //    Update the 'checked' state of a HTML or dijit checkbox.
      // description:
      //    Update the checkbox 'checked' state. In case of a HTML checkbox the
      //    checked state can only be 'true' or 'false', an additional attribute
      //    'mixed' is used to store the mixed state. 
      //    The visual aspect of a mixed checkbox state is only supported when
      //    using the dijit style checkbox (default).
      //  checked:
      //    The new checkbox state which can be either true, false or 'mixed'.
      //
      switch( this.tree.checkboxStyle ) {
        case "dijit":
          this._checkbox._setCheckedState( checked );
          break;
        case "HTML":
          if( this.tree.checkboxMultiState ) {
            domAttr.set( this._checkbox, "mixed", ( checked == "mixed" ? true : false) );
          }
          domAttr.set( this._checkbox, "checked", (checked ? true : false) );
          break;
      }
    },
    
    _getCheckedState: function() {
      // summery:
      //    Get the current checked state of the checkbox.
      // description:
      //    Get the current checked state of the checkbox. It returns true
      //    or false.

      return this._checkbox.checked;
    },
    
    postCreate: function() {
      // summary:
      //    Handle the creation of the checkbox after the cbtreeTreeNode has been
      //    instanciated.
      // description:
      //    Handle the creation of the checkbox after the cbtreeTreeNode has been
      //    instanciated. If a customIconClass was specified for the tree, set it
      //    here and remove the default 'dijit' classes. (see template).
      //
      if( this.tree.customIcons )
      {
        domClass.replace( this.iconNode, this.tree.customIcons.cssClass, "dijitIcon dijitTreeIcon" );
      }
      this._createCheckbox();
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
    //    'cbtreeFolderOpened', 'cbtreeFolderClosed' and 'cbtreeLeaf'. The primary 
    //    ccs class for the icon stip itself can be set using the 'customIconClass'
    //    property.
    customIcons: undefined,
    
    // customIconClass: String
    //    Sets the primary css class for custom Icons. Only valid in conjunction
    //    with the 'customIcons' property. The default value is 'cbtreeIcon'.
    customIconClass: "cbtreeIcon",

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

    _onCheckboxChange: function(/*dojo.data.Item*/ storeItem ) {
      // summary:
      //    Process notification of a change to a checkbox state (triggered
      //    by the model).
      // description:
      //    Whenever the model changes the state of a checkbox in the dojo.data
      //    store it will trigger the 'onCheckboxChange' event allowing the Tree
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
          state    = model._getCheckboxState( storeItem ),
          identity = model.getIdentity(storeItem),
          nodes    = this._itemNodesMap[identity];
    
      // As of dijit.Tree 1.4 multiple references (parents) are supported,
      // therefore we may have to update multiple tree nodes which are all
      // associated with the same dojo.data.item.
      if( nodes ) {
        array.forEach( nodes, function(node) {
          if( node._checkbox != null )
            node._setCheckedState( state );
        }, this );
      }
    }, 

    _onClick: function(/*TreeNode*/ nodeWidget, /*Event*/ e) {
      // summary:
      //    Translates click events into commands for the controller to
      //    process.
      // description:
      //    the _onClick function is called whenever a mouse 'click' is
      //    detected. This instance of _onClick only handles the click
      //    events associated with the checkbox whos DOM name is 'INPUT'.
      // 

      // Only handle checkbox clicks here
      if(e.target.nodeName != 'INPUT') {
        return this.inherited( arguments );
      }

      var isExpando = ( nodeWidget.isExpandable || this.isExpandoNode( e.target, nodeWidget ) ),
        storeItem = nodeWidget.item;
        
      this._publish("execute", { item: storeItem, node: nodeWidget, evt: e} );
      // Go tell the model to update the checkbox state
      this.model.updateCheckbox( storeItem, nodeWidget._getCheckedState() ); 
      // Generate some additional events users can connect to...
      this.onClick( storeItem, nodeWidget, e );
      if( nodeWidget._getCheckedState() ) {
        this.onNodeChecked( storeItem, nodeWidget);
      } else {
        this.onNodeUnchecked( storeItem, nodeWidget);
      }
      if( isExpando )
      {
        this.onParentNode( storeItem, nodeWidget, e );
      }
      if( this.checkboxStyle == "dijit" ) {
        event.stop(e);
      }
      this.focusNode(nodeWidget);
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
          if( typeof(e.charOrCode) == "string" && e.charOrCode == " " ) {
            this.model.updateCheckbox( treeNode.item, !treeNode._checkbox.checked );
          }
        }
      }
      return this.inherited(arguments);  /* Pass it on to the parent tree... */
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

    onNodeChecked: function(/*dojo.data.Item*/ storeItem, /*treeNode*/ treeNode) {
      // summary:
      //    Callback when a checkbox tree node is checked
      // tags:
      //    callback
    },
    
    onNodeUnchecked: function(/*dojo.data.Item*/ storeItem, /*treeNode*/ treeNode) {
      // summary:
      //    Callback when a checkbox tree node is unchecked
      // tags:
      //    callback
    },
    
    onParentNode: function(/*dojo.data.Item*/ storeItem, /*treeNode*/ treeNode, /*Event*/ e ) {
      // summary:
      //    Callback when a parent checkbox gets checked/unchecked
      // tags:
      //    callback
    },
    
    postCreate: function() {
      // summary:
      //    Handle any specifics related to the tree and model after the
      //    instanciationof the Tree. 
      // description:
      //    Whenever checkboxes are requested Validate if we have a 'write'
      //    store first. Subscribe to the 'onCheckboxChange' event (triggered
      //    by the model) and kickoff the initial checkbox data validation.
      //
      var store = this.model.store;

      if( this.checkboxStyle !== "none" ) {
        if(!store.getFeatures()['dojo.data.api.Write']){
          throw new Error("Tree: store must support dojo.data.Write");
        }
        this.connect(this.model, "onCheckboxChange", "_onCheckboxChange");
        this.model._validateData( this.model.root, this.model );
      }
      this.inherited(arguments);
    }
  });  /* end declare() Tree */

});  /* end define() */
