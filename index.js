'use strict';

module.exports = function nestedSetPlugin (schema, options) {
	//prepare arguments
	options = options || {};

	schema.add({
		lft      : { type: Number, required: true, min: 1, default: 1 },
		rgt      : { type: Number, required: true, min: 2, default: 2, index: true },
		parentID : { type: Schema.ObjectId, index: true },
		treeID   : { type: Schema.ObjectId, required: true, index: true }
	});
	
	schema.index({ lft: 1, rgt: 1 });




	schema.pre('save', function(next) {
		var _this = this;

    	if (!this.parentID) {
    		//generate new treeID
    		this.treeID = Schema.ObjectId();
    		return next();
    	}

    	this.parent(function(err, parent) {
    		if(err) {
    			return next(err);
    		}

    		_this.constructor.update({ 
    			lft: { $gte: parent.rgt },
    			treeID : parent.treeID 
    		}, { $inc: { lft: 2 } }, { multi: true }, function(err, numAffectedRows) {
    			if(err) {
    				return next(err);
    			}

    			_this.constructor.update({ 
	    			rgt: { $gte: parent.rgt },
	    			treeID : parent.treeID 
	    		}, { $inc: { rgt: 2 }}, { multi: true }, function(err, numAffectedRows) {
	    			if(err) {
    					return next(err);
    				}

	    			_this.treeID = parent.treeID;
		    		_this.lft = parent.rgt;
		    		_this.rgt = parent.rgt + 1;

		    		next();
	    		});
    		});
    	});
    });


    schema.pre('remove', function(next) {
    	var _this = this,
    		width = (this.rgt-this.lft)+1;

    	this.constructor.remove({
    		treeID : this.treeID,
    		lft    : { 
    			$gt: this.lft,
    			$lt: this.rgt
    		}
    	}, function(err, numAffectedRows) {
    		if(err) {
    			return next(err);
    		}

    		_this.constructor.update({ 
    			rgt: { $gt: _this.rgt },
    			treeID : _this.treeID 
    		}, { $inc: { rgt: -width } }, { multi: true }, function(err, numAffectedRows) {
    			if(err) {
    				return next(err);
    			} 

    			_this.constructor.update({ 
	    			lft: { $gt: _this.rgt },
	    			treeID : _this.treeID 
	    		}, { $inc: { lft: -width } }, { multi: true }, function(err, numAffectedRows) {
	    			if(err) {
	    				return next(err);
	    			} 

	    			next();
	    		});  
    		});   		
    	});
    });


    schema.method('addChild', function(data, cb) {
    	data.parentID = this._id;

    	this.constructor.create(data, cb);
	});

    schema.method('isChild', function() {
    	return !!this.parentID;
	});

	// Returns true if the node is a leaf node (i.e. has no children)
	schema.method('isLeaf', function() {
    	return this.lft && this.rgt && (this.rgt - this.lft === 1);
	});

	schema.method('parent', function(callback) {
		if(!this.isChild()) {
			return callback(null, null);
		}

    	this.constructor.findOne({_id: this.parentID}, callback);
  	});

	schema.method('children', function(callback) {
		this.constructor.find({parentID: this._id}, callback);
	});

	schema.method('childrenWithCurrent', function(callback) {
		var _this = this;
		
		this.children(function(err, nodes) {
			if (err) {
				return callback(err);
      		}

      		nodes.push(_this);

        	callback(null, nodes);
		});
	});

	schema.method('siblings', function(callback) {
		var _this = this;

		this.siblingsWithCurrent(function(err, nodes) {
			if (err) {
				return callback(err);
      		}

      		nodes = nodes.filter(function(node) { 
      			return !_this._id.equals(node._id); 
      		});

      		callback(null, nodes);
		});
	});

	schema.method('siblingsWithCurrent', function(callback) {
		this.constructor.find({ parentID: this.parentID }, callback);
	});
};