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
], function(CheckBox, declare, domAttr) {

	return declare( "twc.CheckBox", [CheckBox], {
		// baseClass: [protected] String
		//		Root CSS class of the widget (ex: twcCheckBox), used to add CSS
		//		classes of widget.
		//		(ex: "twcCheckBox twcCheckBoxChecked twcCheckBoxMixed")
		baseClass: "twcCheckBox",

		// value: String
		//		As an initialization parameter, equivalent to value field on
		//		normal checkbox (if checked, the value is passed as the value
		//		when form is submitted).
		value: "unchecked",

		// value:	Boolean
		//		Indicate if the checkbox is a mutli state checkbox or not. If
		//		multiState is true the 'checked' attr can be either: 'mixed',
		//		true or false otherwise 'checked' can only be true or false.
		multiState: true,

		_setValueAttr: function(/*String or Boolean*/ newValue, /*Boolean*/ priorityChange){
			// summary:
			//		Handler for value= attribute to constructor, Overwrites the
			//		default '_setValueAttr' method as we will handle the Checkbox
			//		checked attribute explictly.
			// description:
			//		If passed a string, changes the value attribute of the CheckBox
			//		(the one specified as "value" when the CheckBox was constructed).

			if(typeof newValue == "string"){
				this.value = newValue;
				domAttr.set(this.focusNode, 'value', newValue);
			}
		},

		_setState: function( /* Object */ state ) {
			// summary
			//		Set the new checked state of the checkbox.
			// description
			//		Set the new checked state of the checkbox and update the state
			//		classes (css classes) accordingly. 
			//
			//		NOTE:	As of version 1.7, dojo has adopted our concept of a
			//				'mixed' checked state, as a result the checked attr of
			//				a widget can now be "mixed", true or false. Therefore
			//				we no longer need to overwrite _setStateClass().
			//				(the 'mixed' state is still not supported on dijit
			//				checkboxes).
			//	state:
			//		The state argument is an object with two properties: 'checked'
			//		and 'mixed' 
			var newValue;
			var checked;
			
			if( this.multiState ) {
				newValue = state.mixed ? "mixed" : ( state.checked ? "checked" : "unchecked" );
				checked  = state.mixed ? "mixed" : ( state.checked ? true : false );
			} else {
				newValue = state.checked ? "checked" : "unchecked";
				checked  = state.checked ? true : false;
			};
			this.set( "checked", checked );
			this.set( "value", newValue );
			// Update css classes
			this._setStateClass();
		}

	});	/* end declare() */

});	/* end define() */
