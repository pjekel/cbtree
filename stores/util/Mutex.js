define(["dojo/Deferred"], function (Deferred) {
	"use strict";

	function Mutex () {
		// summary:
		//  tag:
		//		Public
		var listeners = [];
		var locked    = false;
		var self      = this;

		function signalListener () {
			if (listeners.length) {
				var listener = listeners[0];
				try {
					listener.cb();
				} catch (err) {
					self.onError(err);
					throw err;
				}
				return true;
			}
		}

		this.aquire = function (callback, scope) {
			return this.then( function () {
				scope ? callback.call(scope) : callback();
			});
		};

		this.then = function (callback) {
			var listener = {cb: callback, def: new Deferred()};
			listeners.push(listener);
			if (!locked) {
				locked = true;
				signalListener();
			}
			return listener.def.promise;
		};

		this.release = function (value) {
			if (locked) {
				var listener = listeners.shift();
				listener.def.resolve(value);
				if (!signalListener()) {
					locked = false;
				}
			}
		};

		this.onError = function (value) {
			if (locked) {
				var listener = listeners.shift();
				listener.def.reject(value);
				if (!signalListener()) {
					locked = false;
				}
			}
		};
	}
	return Mutex;
});