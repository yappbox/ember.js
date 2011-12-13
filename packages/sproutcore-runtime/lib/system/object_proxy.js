var get = Ember.get, getPath = Ember.getPath, setPath = Ember.setPath, addObserver = Ember.addObserver;

Ember.ObjectProxy = Ember.Object.extend({
  content: null,

  init: function() {
    this._super();
    this._observedProperties = Ember.A();
    this.contentDidChange();
  },

  unknownProperty: function(key) {
    var content = get(this, 'content');

    return getPath(content, key);
  },

  setUnknownProperty: function(key, value) {
    var content = get(this, 'content');

    setPath(content, key, value);

    return this;
  },

  _observedProperties: [],

  contentWillChange: Ember.beforeObserver(function() {
    var content = get(this, 'content'), observing = this._observedProperties;
    console.log('contentWillChange', Ember.guidFor(this));
    debugger;
  }, 'content'),

  contentDidChange: Ember.observer(function() {
    var content = get(this, 'content'), observing = this._observedProperties;
    console.log('contentDidChange', Ember.guidFor(this));

    if (content) {
      //debugger;
    }
  }, 'content'),

  didAddListener: function(eventName, target, method) {
    var content = get(this, 'content'), observing = this._observedProperties,
        split = eventName.split(':'),
        property = split[0],
        event = split[1];

    addObserver(content, property, this, this.contentPropertyDidChange);
    observing.push(property);
    debugger;
    console.log('didAddListener', Ember.guidFor(this));
  },

  contentPropertyDidChange: function(content, property) {
    this.propertyDidChange(property);
  }
});
