var get = Ember.get, set = Ember.set;
var indexOf = Ember.EnumerableUtils.indexOf;

var Person, array, adapter, passedUrl, passedVerb, passedHash;

function ajaxResponse(adapter, value) {
  adapter.ajax = function(url, verb, hash) {
    passedUrl = url;
    passedVerb = verb;
    passedHash = hash;

    return Ember.RSVP.resolve(value);
  };
}

module("unit/record_array - DS.RecordArray", {
  setup: function() {
    array = [{ id: '1', name: "Scumbag Dale" }, { id: '2', name: "Scumbag Katz" }, { id: '3', name: "Scumbag Bryn" }];

    Person = DS.Model.extend({
      name: DS.attr('string')
    });
  }
});

test("a record array is backed by records", function() {
  var store = createStore();
  store.pushMany(Person, array);

  store.findByIds(Person, [1,2,3]).then(async(function(records) {
    for (var i=0, l=get(array, 'length'); i<l; i++) {
      deepEqual(records[i].getProperties('id', 'name'), array[i], "a record array materializes objects on demand");
    }
  }));
});

test("acts as a live query", function() {
  var store = createStore();

  var recordArray = store.all(Person);
  store.push(Person, { id: 1, name: 'wycats' });
  equal(get(recordArray, 'lastObject.name'), 'wycats');

  store.push(Person, { id: 2, name: 'brohuda' });
  equal(get(recordArray, 'lastObject.name'), 'brohuda');
});

test("a loaded record is removed from a record array when it is deleted", function() {
  var Tag = DS.Model.extend({
    people: DS.hasMany('person')
  });

  Person.reopen({
    tag: DS.belongsTo('tag')
  });

  var env = setupStore({ tag: Tag, person: Person }),
      store = env.store;

  store.pushMany('person', array);
  store.push('tag', { id: 1 });

  var asyncRecords = Ember.RSVP.hash({
    scumbag: store.find('person', 1),
    tag: store.find('tag', 1)
  });

  asyncRecords.then(async(function(records) {
    var scumbag = records.scumbag, tag = records.tag;

    tag.get('people').addObject(scumbag);
    equal(get(scumbag, 'tag'), tag, "precond - the scumbag's tag has been set");

    var recordArray = tag.get('people');

    equal(get(recordArray, 'length'), 1, "precond - record array has one item");
    equal(get(recordArray.objectAt(0), 'name'), "Scumbag Dale", "item at index 0 is record with id 1");

    scumbag.deleteRecord();

    equal(get(recordArray, 'length'), 0, "record is removed from the record array");
  }));
});

// GitHub Issue #168
test("a newly created record is removed from a record array when it is deleted", function() {
  var store = createStore(),
      recordArray;

  recordArray = store.all(Person);

  var scumbag = store.createRecord(Person, {
    name: "Scumbag Dale"
  });

  equal(get(recordArray, 'length'), 1, "precond - record array already has the first created item");

  // guarantee coalescence
  Ember.run(function() {
    store.createRecord(Person, { name: 'p1'});
    store.createRecord(Person, { name: 'p2'});
    store.createRecord(Person, { name: 'p3'});
  });

  equal(get(recordArray, 'length'), 4, "precond - record array has the created item");
  equal(get(recordArray.objectAt(0), 'name'), "Scumbag Dale", "item at index 0 is record with id 1");

  scumbag.deleteRecord();

  equal(get(recordArray, 'length'), 3, "record is removed from the record array");

  recordArray.objectAt(0).set('name', 'toto');

  equal(get(recordArray, 'length'), 3, "record is still removed from the record array");
});

test("a record array returns undefined when asking for a member outside of its content Array's range", function() {
  var store = createStore();

  store.pushMany(Person, array);

  var recordArray = store.all(Person);

  strictEqual(recordArray.objectAt(20), undefined, "objects outside of the range just return undefined");
});

// This tests for a bug in the recordCache, where the records were being cached in the incorrect order.
test("a record array should be able to be enumerated in any order", function() {
  var store = createStore();
  store.pushMany(Person, array);

  var recordArray = store.all(Person);

  equal(get(recordArray.objectAt(2), 'id'), 3, "should retrieve correct record at index 2");
  equal(get(recordArray.objectAt(1), 'id'), 2, "should retrieve correct record at index 1");
  equal(get(recordArray.objectAt(0), 'id'), 1, "should retrieve correct record at index 0");
});

var shouldContain = function(array, item) {
  ok(indexOf(array, item) !== -1, "array should contain "+item.get('name'));
};

var shouldNotContain = function(array, item) {
  ok(indexOf(array, item) === -1, "array should not contain "+item.get('name'));
};

test("an AdapterPopulatedRecordArray knows if it's loaded or not", function() {
  var env = setupStore({ person: Person }),
      store = env.store;

  env.adapter.findQuery = function(store, type, query, recordArray) {
    return Ember.RSVP.resolve(array);
  };

  store.find('person', { page: 1 }).then(async(function(people) {
    equal(get(people, 'isLoaded'), true, "The array is now loaded");
  }));
});

test("an AdapterPopulatedRecordArray can load more records", function() {
  var env = setupStore({ person: Person, adapter: DS.FixtureAdapter }),
      store = env.store;

  Person.FIXTURES = [
    {id: 1, name: 'Dimebag Dale'},
    {id: 2, name: 'Yehuda Brynjolffsosysdfon'}
  ];

  store.adapterFor(Person).set('pageSize', 1);
  store.findAll('person').then(async(function(people) {
    equal(get(people, 'length'), 1, "First page of results loaded");
    people.loadMore().then(async(function() {
      equal(get(people, 'length'), 2, "Second page of results loaded");
    }));
  }));
});

test("an AdapterPopulatedRecordArray can load a specific page", function() {
  var env = setupStore({ person: Person, adapter: DS.FixtureAdapter }),
      store = env.store;

  Person.FIXTURES = [
    {id: 1, name: 'Dimebag Dale'},
    {id: 2, name: 'Yehuda Brynjolffsosysdfon'},
    {id: 3, name: 'Brynjolffsosysdfon Katz'}
  ];

  store.adapterFor(Person).set('pageSize', 1);
  store.findAll('person').then(async(function(people) {
    equal(get(people, 'length'), 1, "First page of results loaded");
    people.loadPage(3).then(async(function() {
      equal(get(people, 'length'), 1, "Only one page is loaded at a time");
      equal(people.objectAt(0).get('id'), 3, "Third page of results loaded");
    }));
  }));
});


test("an AdapterPopulatedRecordArray contains the requested page and pageSize", function() {
  var env = setupStore({ person: Person, adapter: DS.FixtureAdapter }),
      store = env.store, pageSize = 1, page = 2;


  Person.FIXTURES = [
    {id: 1, name: 'Dimebag Dale'},
    {id: 2, name: 'Yehuda Brynjolffsosysdfon'},
    {id: 3, name: 'Brynjolffsosysdfon Katz'}
  ];

  store.adapterFor(Person).set('pageSize', pageSize);
  store.findAll('person', page).then(async(function(people) {
    equal(get(people, 'page'), page);
    equal(get(people, 'pageSize'), pageSize);
  }));
});

test("use pageSize from the server if it's specified in the metadata", function() {
  var env = setupStore({ person: Person, adapter: DS.RESTAdapter }),
      store = env.store, pageSize = 10;

  ajaxResponse(env.adapter, { meta: { pageSize: pageSize }, people: [{ id: 1, name: "Dimebag Dale" }] });
  store.adapterFor(Person).set('pageSize', 1);
  store.findAll('person').then(async(function(people) {
    equal(get(people, 'pageSize'), pageSize);
  }));
});

test("totalPages is computed from the total returned by the server", function() {
  var env = setupStore({ person: Person, adapter: DS.RESTAdapter }),
      store = env.store, total = 12, pageSize = 10;

  ajaxResponse(env.adapter, { meta: { pageSize: pageSize, total: total }, people: [{ id: 1, name: "Dimebag Dale" }] });
  store.findAll('person').then(async(function(people) {
    equal(get(people, 'totalPages'), Math.ceil(total / pageSize));
  }));
});

test("isFinished is true when endPage >= totalPages", function() {
  var env = setupStore({ person: Person, adapter: DS.RESTAdapter }),
      store = env.store, total = 12, pageSize = 10, page = 2;

  ajaxResponse(env.adapter, { meta: { pageSize: pageSize, total: total }, people: [{ id: 1, name: "Dimebag Dale" }] });
  store.findAll('person', page).then(async(function(people) {
    equal(get(people, 'isFinished'), true);
  }));
});

test("isFinished is true when endPage >= totalPages", function() {
  var env = setupStore({ person: Person, adapter: DS.RESTAdapter }),
      store = env.store;

  ajaxResponse(env.adapter, { meta: { isFinished: true, pageSize: 10 }, people: [{ id: 1, name: "Dimebag Dale" }] });
  store.findAll('person').then(async(function(people) {
    equal(get(people, 'isFinished'), true);
  }));
});

