// ==========================================================================
// Project:   SproutCore Views
// Copyright: ©2011 Strobe Inc. and contributors.
// License:   Licensed under MIT license (see license.js)
// ==========================================================================

/*
  Adds support for mouseStart, mouseEnd, and mouseDragged, which are like
  mouseDown, mouseMove, mouseUp except they lock onto the first view that 
  responds to mouseStart.  This makes these events behave like touch events
  and therefore work more consistently for an app-like interface where you
  have can have nested views that each respond to touch/mouse event streams.
*/

var jQuery = SC.$;
var event  = jQuery.event;
var _targets = null; // allow for multiple subscribers

var indexOf = Array.prototype.indexOf;
if (!indexOf) {
  indexOf = function(item) {
    var len = this.length;
    for(var idx=0;idx<len;idx++) {
      if (this[idx]===item) return idx;
    }
    return -1;
  }
}

function fix(type, evt) {
  evt = event.fix(evt);
  evt.type = type;
  //evt.stopPropagation();
  return evt;
}

function mouseDown(evt) {
  if (!_targets) {
    _targets = [];
    event.add(window, 'mousemove', mouseMove);
    event.add(window, 'mouseup', mouseUp);
  }

  var target = evt.target;

  if (indexOf.call(_targets, evt.target)<0) {
    _targets.push(target);

    // deliver mousestart to the current target only since this function
    // will be called for each target.
    evt = fix('mousestart', evt.originalEvent);
    event.trigger(evt, null, target);
  }
}

function mouseMove(evt) {
  if (!_targets) return;

  evt = fix('mousedragged', evt.originalEvent);
  _targets.forEach(function(target) {
    event.trigger(evt, null, target);
  });
}

function mouseUp(evt) {
  if (!_targets) return; 

  evt = fix('mouseend', evt.originalEvent);
    _targets.forEach(function(target) {
    event.trigger(evt, null, target);
  });

  _targets = null;
  event.remove(window, 'mousemove', mouseMove);
  event.remove(window, 'mouseup', mouseUp);
}

function setup() {
  var data = jQuery._data(this);
  if (!data.startConfigured) {
    data.startConfigured = 1;
    event.add(this, 'mousedown', mouseDown);
  }
}

function teardown() {
  var data = jQuery._data(this);
  if (data.startConfigured === 1) event.remove(this, 'mousedown', mouseDown);
  if (data.startConfigured>0) data.startConfigured--;
}

var CUSTOM_EVENT = {
  setup: setup,
  teardown: teardown
};

['mousestart', 'mouseend', 'mousedragged'].forEach(function(name) {
  jQuery.event.special[name] = CUSTOM_EVENT;
});

