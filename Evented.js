define(["dojo/aspect", "dojo/on"], function(aspect, on){
   "use strict";

  // module:
  //    cbtree/Evented
  // summary:
  //    This module is intended for the use with non dijit widgets providing the
  //    same on() behavour as dijit Widgets when registering event listeners.
  //    (See also: dojo/Evented)

  function Evented() {
    // summary:
    //    A class that can be used as a mixin or base class,
    //    to add on() and emit() methods to a class
    //    for listening for events and emitting events:
    //
    //    |  define(["cbtree/Evented"], function(Evented){
    //    |    var EventedWidget = dojo.declare([Evented, dijit._Widget], {...});
    //    |    widget = new EventedWidget();
    //    |    widget.on("open", function(event){
    //    |    ... do something with event
    //    |   });
    //    |
    //    |  widget.emit("open", {name:"some event", ...});

    this.on = function(type, listener) {

      function onMethod( target, type) {
        var method = "on" + type.replace(/^[a-z]/, function(m) { return m.toUpperCase() });
        if (typeof target[method] == "function") {
          return method;
        }
        return ("on" + type);
      }

      return on.parse(this, type, listener, function(target, type){
        return aspect.after(target, onMethod(target, type), listener, true);
      });
    };

    this.emit = function(type, event){
      var args = [this];
      if (!event.type) event.type = type;
      args.push.apply(args, arguments);
      return on.emit.apply(on, args);
    };

  };
  return Evented;
});
