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
  "dijit/form/CheckBox",
  "dojo/_base/declare",
  "dojo/dom-attr"
], function( CheckBox, declare, domAttr ) {

  return declare( [CheckBox], {
    // baseClass: [protected] String
    //    Root CSS class of the widget (ex: twcCheckBox), used to add CSS
    //    classes of widget.
    //    (ex: "twcCheckBox twcCheckBoxChecked twcCheckBoxMixed")
    baseClass: "cbtreeCheckBox",

    // value:  Boolean
    //    Indicate if the checkbox is a mutli state checkbox or not. If
    //    multiState is true the 'checked' attr can be either: 'mixed',
    //    true or false otherwise 'checked' can only be true or false.
    multiState: true,

    _getCheckedAttr: function() {
      return this.checked;
    },
    
    _setCheckedAttr: function( /*Boolean | String*/ checked, /*Boolean?*/ priorityChange ) {
      // summary
      //    Set the new checked state of the checkbox.
      // description
      //    Set the new checked state of the checkbox.
      //  state:
      //    New state which is either true, false or 'mixed'
      var newState = (this.multiState ? checked : (checked ? true : false));

      this._set("checked", newState );      /* Fast track set() procedure */
      domAttr.set(this.focusNode || this.domNode, "checked", newState );
      (this.focusNode || this.domNode).setAttribute("aria-checked", newState );
    },

    _setValueAttr: function(/*String or Boolean*/ newValue, /*Boolean?*/ priorityChange){
      // summary:
      //    Handler for value= attribute to constructor, Overwrites the
      //    default '_setValueAttr' method as we will handle the Checkbox
      //    checked attribute explictly.
      // description:
      //    If passed a string, changes the value attribute of the CheckBox
      //    (the one specified as "value" when the CheckBox was constructed).
      //
      //    NOTE: Changing the checkbox value DOES NOT change the checked state.
      
      if(typeof newValue == "string"){
        this.value = newValue;
        domAttr.set(this.focusNode, 'value', newValue);
        this._handleOnChange(newValue, priorityChange);
      }
    },

    _onClick: function( /*Event*/ evt ) {
      // summary:
      //    Process a click event on the checkbox.
      // description:
      //    Process a click event on the checkbox. If the checkbox is in a mixed
      //    state it will change to checked. Any other state will just toggle the
      //    current checkbox state.
      //
      //    NOTE: A click event will never change the state to mixed.
      
      if( this._toggleChecked() ) {
        return this.onClick(evt);
      }
      event.stop(evt);
    },

    _onKeyPress: function(/*Event*/ evt ){
      // summary:
      //    Toggle the checkbox state when the user pressed the spacebar.
      // description:
      //    Toggle the checkbox state when the user pressed the spacebar.
      //    The spacebar is only processed if the widget that has focus is
      //    a tree node and has a checkbox.
      //
      if( !evt.altKey ) {
        if( (typeof evt.charOrCode == "string") && (evt.charOrCode == " ") ) {
          if( this._toggleChecked() ) {
            return onKeyPress( evt );
          }
          event.stop(evt);
        }
      }
    },

    _toggleChecked: function() {
      // summary:
      //    Toggle the current checkbox state. 
      //
      if(!this.readOnly && !this.disabled){
        var curState = this.get( "checked" );
        this._setCheckedAttr( (curState == 'mixed' ? true : !curState ), null );      
        return true;
      }
      return false;
    }

  });  /* end declare() */


});  /* end define() */
