var should = require('should'),
	request = require('supertest'),
	mongoose = require('mongoose'),
	Schema = mongoose.Schema,
	nestedSetPlugin = require('../index');

var Category = null,
	base = null,
	child1 = null;


describe('Nested set', function() {

	it('should be able to connect', function(done) {
		mongoose.connect('mongodb://localhost/nestedset-test');
		done();
	});

	it('should be able to create model', function(done) {
		var schema = new Schema({
			title: { type: String, required: true }
		});

		schema.plugin(nestedSetPlugin, {});

		Category = mongoose.model('Category', schema);

		done();
	});

	it('should be able to empty collection', function(done) {
		Category.remove({}, function(err) { 
		   done();
		});
	});
	

	it('should be able to create a new tree', function(done) {
		Category.create({
			title: 'Base'
		}, function(err, item) {
			if(err) {
				throw err;
			}

			base = item;

			item.lft.should.equal(1);
			item.rgt.should.equal(2);

			item.treeID.should.equal(item._id);

			item.deep.should.equal(0);

			done();
		});
	});

	it('should be able to create a new child', function(done) {

		base.append({
			title: 'child'
		}, function(err, child) {
			if(err) {
				throw err;
			}

			child1 = child;

			child.lft.should.equal(2);
			child.rgt.should.equal(3);

			child.treeID.equals(base.treeID).should.equal(true);

			child.deep.should.equal(1);

			done();
		});
	});

	it('should be able to create a new child2', function(done) {

		base.append({
			title: 'child2'
		}, function(err, child) {
			if(err) {
				throw err;
			}

			child.lft.should.equal(4);
			child.rgt.should.equal(5);

			child.treeID.equals(base.treeID).should.equal(true);

			child.deep.should.equal(1);

			done();
		});
	});

	it('should be able to create a new subchild child', function(done) {

		child1.append({
			title: 'sub child1'
		}, function(err, child) {
			if(err) {
				throw err;
			}

			child.lft.should.equal(3);
			child.rgt.should.equal(4);

			child.treeID.equals(base.treeID).should.equal(true);

			child.deep.should.equal(2);

			done();
		});
	});
/*
	it('should be able to remove child', function(done) {

		child1.remove(function(err, removed) {
			if(err) {
				throw err;
			}

			done();
		});
	});

	it('should be able to remove base', function(done) {

		base.remove(function(err, removed) {
			if(err) {
				throw err;
			}

			done();
		});
	});		*/	


	after(function(done) {

		done();
 
	});

});