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
define([], function () {

	// Requires JavaScript 1.8.5
	var defineProperty = Object.defineProperty;

	function Parents (/*String|String[]*/ parentIds) {
		// summary:
		//		Helper class to hide the fact if we are dealing with a single or multi
		//		parent dojo/store.   The default dojo/store only provide support for
		//		single parented objects whereas the cbtree ObjectStoreModel and API
		//		supports both single and multi parented object.
		//		The Parents object is an Array-like object.
		// parentIds:
		//
		// example:
		//	|	var parents = new Parents( storeItem[this.parentAttr] );
		//	|	if (!parents.contains("Homer")) {
		//	|		parents.add("Homer");
		//	| }
		//	|	this.setValue( store.item, this.parentAttr, parents.toValue() );
		// tag:
		//		Private

		var multiple = true;
		var length   = 0;
		var input    = parentIds;

		defineProperty( this, "multiple",	{	get: 	function() {	return multiple; }, enumerable: false });
		defineProperty( this, "length"	,	{	get: 	function() {	return length; }, enumerable: false });
		defineProperty( this, "input"		,	{	get: 	function() {	return input; }, enumerable: false });

		function assign(ids) {
			Array.prototype.splice.call(this, 0,length);
			if (ids instanceof Array) {
				ids.forEach( function(id,idx) {
					this[idx] = id;
					length++;
				},this);
			} else {
				assign.call(this, [ids]);
				multiple = false;
				length   = 1;
			}
		}

		this.add = function (id) {
			// Don't accept duplicates
			if (!this.contains(id)) {
				multiple ? this[length++] = id : this[0] = id;
				return true;
			}
		};

		this.contains = function (id) {
			return Array.prototype.some.call(this, function(member) {
				return member === id;
			});
		};

		this.forEach = function (callback, thisArg) {
			Array.prototype.forEach.call(this, callback, thisArg);
		}

		this.remove = function (id) {
			Array.prototype.some.call(this, function(member,idx) {
				if (member === id) {
					Array.prototype.splice.call(this, idx, 1);
					length--;
					return true;
				}
			}, this );
		};

		this.set = function (id) {
			Array.prototype.splice.call(this, 0,length);
			this[0] = id;
			length = 1;
			return true;
		};

		this.toValue = function() {
			return (multiple ? Array.prototype.slice.call(this) : (this[0] || undefined));
		};

		if (parentIds) {
			assign.call(this, parentIds);
		} else {
			multiple = false;
		}
	} /*end Parents() */

	return Parents;

});	/* end define() */
