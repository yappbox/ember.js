// ==========================================================================
// Project:   SproutCore - JavaScript Application Framework
// Copyright: ©2006-2011 Strobe Inc. and contributors.
//            Portions ©2008-2011 Apple Inc. All rights reserved.
// License:   Licensed under MIT license (see license.js)
// ==========================================================================

var get = SC.get, set = SC.set, fmt = SC.String.fmt, run = SC.run, typeOf = SC.typeOf;

/**
  @ignore

  SC.EventDispatcher handles delegating browser events to their corresponding
  SC.Views. For example, when you click on a view, SC.EventDispatcher ensures
  that that view's `mouseDown` method gets called.
*/
SC.EventDispatcher = SC.Object.extend(
/** @scope SC.EventDispatcher.prototype */{

  /**
    @private

    The root DOM element to which event listeners should be attached. Event
    listeners will be attached to the document unless this is overridden.

    @type DOMElement
    @default document
  */
  rootElement: document,

  /**
    Certain events should 'lock' onto the view that receives the
    initial event and continue to deliver related events until some
    termination point.  This behavior is usually reflected in the DOM
    but must also be implemented here because views do not always
    correspond 1-1 to DOM elements and because jQuery's bubbling will
    often end up delivering events that have already been handled to
    parent containers.
  */
  LOCK_EVENTS: {
    'mouseStart': { 
      'mouseDragged': false, // keep lock
      'mouseEnd':      true  // terminates lock
    },

    'touchStart': {
      'touchChanged': false, // keep lock
      'touchEnd':     true  // terminates lock
    }
  },

  /**
    @private

    Sets up event listeners for standard browser events.

    This will be called after the browser sends a DOMContentReady event. By
    default, it will set up all of the listeners on the document body. If you
    would like to register the listeners on different element, set the event
    dispatcher's `root` property.
  */
  setup: function(addedEvents) {
    var event, events = {
      touchstart  : 'touchStart',
      touchmove   : 'touchMove',
      touchend    : 'touchEnd',
      touchcancel : 'touchCancel',
      keydown     : 'keyDown',
      keyup       : 'keyUp',
      keypress    : 'keyPress',
      mousedown   : 'mouseDown',
      mouseup     : 'mouseUp',
      click       : 'click',
      dblclick    : 'doubleClick',
      mousemove   : 'mouseMove',
      focusin     : 'focusIn',
      focusout    : 'focusOut',
      mouseenter  : 'mouseEnter',
      mouseleave  : 'mouseLeave',
      submit      : 'submit',
      change      : 'change',
      mousestart  : 'mouseStart'
      mousedragged: 'mouseDragged'
      mouseend    : 'mouseEnd'
    };

    jQuery.extend(events, addedEvents || {});

    var rootElement = SC.$(get(this, 'rootElement'));

    sc_assert(fmt('You cannot use the same root element (%@) multiple times in an SC.Application', [rootElement.selector || rootElement[0].tagName]), !rootElement.is('.sc-application'));
    sc_assert('You cannot make a new SC.Application using a root element that is a descendent of an existing SC.Application', !rootElement.closest('.sc-application').length);
    sc_assert('You cannot make a new SC.Application using a root element that is an ancestor of an existing SC.Application', !rootElement.find('.sc-application').length);

    rootElement.addClass('sc-application')

    for (event in events) {
      if (events.hasOwnProperty(event)) {
        this.setupHandler(rootElement, event, events[event]);
      }
    }
  },

  /**
    @private

    Registers an event listener on the document. If the given event is
    triggered, the provided event handler will be triggered on the target
    view.

    If the target view does not implement the event handler, or if the handler
    returns false, the parent view will be called. The event will continue to
    bubble to each successive parent view until it reaches the top.

    For example, to have the `mouseDown` method called on the target view when
    a `mousedown` event is received from the browser, do the following:

        setupHandler('mousedown', 'mouseDown');

    @param {String} event the browser-originated event to listen to
    @param {String} eventName the name of the method to call on the view
  */
  setupHandler: function(rootElement, event, eventName) {
    var self = this;

    rootElement.delegate('.sc-view', event + '.sproutcore', function(evt, triggeringManager) {

      var view = SC.View.views[this.id],
          result = true, manager = null;

      manager = self._findNearestEventManager(view,eventName);

      if (manager && manager !== triggeringManager) {
        result = self._dispatchEvent(manager, evt, eventName, view);
      } else if (view) {
        result = self._bubbleEvent(view,evt,eventName);
      } else {
        evt.stopPropagation();
      }

      return result;
    });
  },

  /** @private */
  _findNearestEventManager: function(view, eventName) {
    var manager = null;

    while (view) {
      manager = get(view, 'eventManager');
      if (manager && manager[eventName]) { break; }

      view = get(view, 'parentView');
    }

    return manager;
  },

  /** @private */
  _dispatchEvent: function(object, evt, eventName, view) {
    var result = true;

    handler = object[eventName];
    if (SC.typeOf(handler) === 'function') {
      result = handler.call(object, evt, view);
      evt.stopPropagation();
    }
    else {
      result = this._bubbleEvent(view, evt, eventName);
    }

    return result;
  },

  /** @private */
  _bubbleEvent: function(view, evt, eventName) {

    var LOCK_EVENTS  = this.LOCK_EVENTS,
        lockedEvents = this._lockedEvents,
        history;

    function bubble() {
      var result = true, handler;
      run(function() {
        handler = view[eventName];
        if (typeOf(handler) === 'function') {
          result = handler.call(view, evt);
        }
      });
      return result;
    }
    
    // if we are in a lock state and the event is a lock event, then
    // deliver only to the locked view.  Note: this implementation assumes
    // the normal browser event bubbling from jQuery will call the lock view
    // eventually.  There are some cases (notably when the DOM for the lockView
    // has been removed) where this may not happen.  It's an edge case that a
    // developer will probably have to work around but the browser has the same 
    // edge case so we are leaving it here.
    // 
    if (lockedEvents && lockedEvents[eventName] !== undefined) {
      if (view === this._lockedView) {
        ret = bubble();
        evt.stopPropagation();

        // cleanup if event terminates the lock
        if (lockedEvents[eventName]) {
          this._lockedEvents = this._lockedView = null;
        }
      } // else do nothing since we don't want to deliver to non-locked views
    
    } else {
      
      ret = bubble();

      // lock if event handler returns anything OTHER than false (incl
      // void)
      if (LOCK_EVENTS[eventName] && (ret !== false)) {
        this._lockedView = view;
        this._lockedEvents = LOCK_EVENTS[eventName];
        evt.stopPropagation();
      }
    }

    return ret;
  },

  /** @private */
  destroy: function() {
    var rootElement = get(this, 'rootElement');
    SC.$(rootElement).undelegate('.sproutcore').removeClass('sc-application');
    return this._super();
  }
});
