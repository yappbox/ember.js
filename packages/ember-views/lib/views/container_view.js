// ==========================================================================
// Project:   Ember - JavaScript Application Framework
// Copyright: ©2006-2011 Strobe Inc. and contributors.
//            Portions ©2008-2011 Apple Inc. All rights reserved.
// License:   Licensed under MIT license (see license.js)
// ==========================================================================

require('ember-views/views/core_view');
var get = Ember.get, set = Ember.set, meta = Ember.meta;

var RENDER_TIMEOUT = 50;

Ember.ContainerView = Ember.CoreView.extend({

  init: function() {
    // Get a list of views to prepopulate the child
    // views array with. These are provided by the user
    // when creating a new instance of ContainerView
    // in the form childViews: ['foo', 'bar']
    this._super();

    var providedChildViews = get(this, 'childViews')||[];

    var childViews = Ember.A([]);

    providedChildViews.forEach(function(viewName, idx) {
      var view;

      if ('string' === typeof viewName) {
        view = get(this, viewName);
        view = this.createChildView(view);
        set(this, viewName, view);
      } else {
        view = this.createChildView(viewName);
      }

      childViews[idx] = view;
    }, this);

    set(this, 'childViews', childViews);

    childViews.addArrayObserver(this, {
      willChange: 'childViewsWillChange',
      didChange: 'childViewsDidChange'
    });

    this._renderQueue = [];
  },

  /**
    Instructs each child view to render to the passed render buffer.

    @param {Ember.RenderBuffer} buffer the buffer to render to
    @private
  */
  render: function(buffer) {
    var childViews = get(this, 'childViews'),
        _childViews = get(this, '_childViews'),
        renderQueue = this._renderQueue;

    var now = new Date(), view, idx, len = get(childViews, 'length');

    // During first render, start rendering child views as we
    // normally would until our timeout is hit.
    for (idx = 0; idx < len; ) {
      view = childViews.objectAt(idx);
      _childViews.pushObject(view);
      view.renderToBuffer(buffer);

      idx++;

      if (new Date() - now > RENDER_TIMEOUT) {
        break;
      }
    }

    if (idx < len) {
      for ( ; idx < len; idx++) {
        view = childViews.objectAt(idx);
        renderQueue.push([view, idx]);
      }

      this.scheduleRenderQueue(renderQueue);
    }
  },

  scheduleRenderQueue: function(queue) {
    if (this._scheduled) return;

    this._scheduled = true;
    var self = this;
    setTimeout(function() {
      self.processRenderQueue(queue);
      self._scheduled = false;
    }, 50);
  },

  processRenderQueue: function(queue) {
    var view, tuple, viewIdx, now = new Date(), timedOut = false;
    var _childViews = get(this, '_childViews');

    while ((new Date() - now < 50) && (tuple = queue.shift())) {
      view = tuple[0];
      viewIdx = tuple[1];
      shouldRemove = tuple[2];

      if (shouldRemove) {
        _childViews.replace(viewIdx, 1);
        this.invokeForState('removeChildView', viewIdx);
      } else {
        _childViews.replace(viewIdx, 0, [view]);
        if (viewIdx === 0) {
          prev = null;
        } else {
          prev = _childViews.objectAt(viewIdx-1);
        }
        this.invokeForState('insertChildView', view, prev);
      }
    }

    if (queue.length) {
      this.scheduleRenderQueue(queue);
    }
  },

  removeChild: function(view) {
    var childViews = get(this, 'childViews');
    childViews.removeObject(view);

    return this._super(view);
  },

  /**
    Because child views of container views are by definition
    not created during the render phase, there are no
    rendered children to destroy if the view is re-rendered.
  */
  clearRenderedChildren: Ember.K,

  /**
    When the container view is destroyed, tear down the child views
    array observer.

    @private
  */
  destroy: function() {
    get(this, 'childViews').removeArrayObserver(this, {
      willChange: 'childViewsWillChange',
      didChange: 'childViewsDidChange'
    });

    this._super();
  },

  /**
    When a child view is removed, destroy its element so that
    it is removed from the DOM.

    The array observer that triggers this action is set up in the
    `renderToBuffer` method.

    @private
    @param {Ember.Array} views the child views array before mutation
    @param {Number} start the start position of the mutation
    @param {Number} removed the number of child views removed
  **/
  childViewsWillChange: function(views, start, removed) {
    var idx, len, view, renderQueue = this._renderQueue;

    for (idx = start; idx < start+removed; idx++) {
      view = views[idx];
      renderQueue.push([view, idx, true]);
    }

    this.scheduleRenderQueue(renderQueue);
  },

  /**
    When a child view is added, make sure the DOM gets updated appropriately.

    If the view has already rendered an element, we tell the child view to
    create an element and insert it into the DOM. If the enclosing container view
    has already written to a buffer, but not yet converted that buffer into an
    element, we insert the string representation of the child into the appropriate
    place in the buffer.

    @private
    @param {Ember.Array} views the array of child views afte the mutation has occurred
    @param {Number} start the start position of the mutation
    @param {Number} removed the number of child views removed
    @param {Number} the number of child views added
  */
  childViewsDidChange: function(views, start, removed, added) {
    var len = get(views, 'length');

    // No new child views were added; bail out.
    if (added === 0) return;

    var idx, len, renderQueue = this._renderQueue, view;

    for (idx = start; idx < start+added; idx++) {
      view = views.objectAt(idx);
      renderQueue.push([view, idx]);
    }

    this.scheduleRenderQueue(renderQueue);
  },

  /**
    Schedules a child view to be inserted into the DOM after bindings have
    finished syncing for this run loop.

    @param {Ember.View} view the child view to insert
    @param {Ember.View} prev the child view after which the specified view should
                     be inserted
    @private
  */
  _scheduleInsertion: function(view, prev) {
    if (prev) {
      prev.get('domManager').after(view);
    } else {
      this.get('domManager').prepend(view);
    }
  },

  rerender: function() {
    var _childViews = get(this, '_childViews');
    _childViews.replace(0, get(_childViews, 'length'));
    return this._super();
  }
});

// Ember.ContainerView extends the default view states to provide different
// behavior for childViewsWillChange and childViewsDidChange.
Ember.ContainerView.states = {
  parent: Ember.View.states,

  inBuffer: {
    insertChildView: function(view, childView, prev) {
    // childViewsDidChange: function(parentView, views, start, added) {
      var buffer;

      // Determine where to begin inserting the child view(s) in the
      // render buffer.
      if (!prev) {
        // If views were inserted at the beginning, prepend the first
        // view to the render buffer, then begin inserting any
        // additional views at the beginning.
        buffer = Ember.getMeta(view, 'Ember.View').buffer;
        childView.renderToBuffer(buffer, 'prepend');
      } else {
        // Otherwise, just insert them at the same place as the child
        // views mutation.
        buffer = Ember.getMeta(prev, 'Ember.View').buffer;
        childView.renderToBuffer(buffer, 'insertAfter');
      }
    }
  },

  hasElement: {
    removeChildView: function(view, childView) {
      childView.destroyElement();
    },

    insertChildView: function(view, childView, prev) {
      debugger;
      view._scheduleInsertion(childView, prev);
    }
  }
};

Ember.ContainerView.states.inDOM = {
  parentState: Ember.ContainerView.states.hasElement
};

Ember.ContainerView.reopen({
  states: Ember.ContainerView.states
});
