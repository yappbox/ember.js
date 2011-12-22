var getPath = Ember.getPath;

module("ember-views/views/container_view_test");

test("should be able to insert views after the DOM representation is created", function() {
  var container = Ember.ContainerView.create({
    classNameBindings: ['name'],

    name: 'foo'
  });

  Ember.run(function() {
    container.appendTo('#qunit-fixture');
  });

  var view = container.createChildView(Ember.View, {
    template: function() {
      return "This is my moment";
    }
  });

  Ember.run(function() {
    container.get('childViews').pushObject(view);
  });

  stop();

  setTimeout(function() {
    Ember.run(function() {
      start();
      equals(container.$().text(), "This is my moment");

      container.destroy();
    });
  }, 100);
});

test("should be able to observe properties that contain child views", function() {
  var container;

  Ember.run(function() {
    container = Ember.ContainerView.create({
      childViews: ['displayView'],
      displayIsDisplayedBinding: 'displayView.isDisplayed',

      displayView: Ember.View.extend({
        isDisplayed: true
      })
    });

    container.appendTo('#qunit-fixture');
  });

  ok(container.get('displayIsDisplayed'), "can bind to child view");
});

test("should batch changes", function() {
  expect(6);

  container = Ember.ContainerView.create({
    elementId: 'container',
    childViews: ['slow', 'fast'],

    slow: Ember.View.extend({
      render: function(buffer) {
        var time = new Date();
        var x = 0;
        while (new Date() - time < 100) { x++; }
        buffer.push("why u so slow :(");
      }
    }),

    fast: Ember.View.extend({
      render: function(buffer) {
        buffer.push("i am snappy yo");
      }
    })
  });

  Ember.run(function() {
    container.appendTo('#qunit-fixture');
  });

  var html = jQuery('#container').text();

  equal(jQuery("#container").children().length, 1, "only one child view exists");
  equal(jQuery.trim(html), "why u so slow :(", "only the first view should be rendered");
  equal(getPath(container, 'childViews.length'), 2, "all views are already in the hierarchy");

  stop();

  setTimeout(function() {
    start();

    equal(jQuery("#container").children().length, 2, "only one child view exists");
    equal(jQuery.trim(html), "why u so slow :( i am snappy yo", "only the first view should be rendered");
    equal(getPath(container, 'childViews.length'), 2, "all views are already in the hierarchy");
  }, 100);

});
