'use strict';

module.exports = function nestedSetPlugin (schema, options) {
    var Schema = schema.constructor;
	//prepare arguments
	options = options || {};

	schema.add({
		lft      : { type: Number, required: true, min: 1 },
		rgt      : { type: Number, required: true, min: 2, index: true },
		parentID : { type: Schema.ObjectId, index: true },
		treeID   : { type: Schema.ObjectId, required: true, index: true },
        deep     : { type: Number, required: true }
	});
	
	schema.index({ lft: 1, rgt: 1 });

    schema.pre('validate', function(next) {
        var _this = this;

        if (this.parentID) {
            if(this.treeID && this.deep) {
                return next();
            }

            this.parent(function(err, parent) {
                if(err) {
                    return next(err);
                }

                _this.treeID = parent.treeID;
                _this.deep = parent.deep+1;

                next();
            });
        } else {
            this.treeID = this._id;
            this.deep = 0; 
            this.lft = 1; 
            this.rgt = 2; 
            next();   
        }        
    });

    //put actual child at the end of the parent
    schema.method('_append', function(parent, next) {
        var _this = this;

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

                _this.lft = parent.rgt;
                _this.rgt = _this.lft + 1;

                next();
            });
        });
    });

    //put actual child at the end of the parent
    schema.method('_prepend', function(parent, next) {
        var _this = this;

        _this.constructor.update({ 
            lft: { $gt: parent.lft },
            treeID : parent.treeID 
        }, { $inc: { lft: 2 } }, { multi: true }, function(err, numAffectedRows) {
            if(err) {
                return next(err);
            }

            _this.constructor.update({ 
                rgt: { $gt: parent.lft },
                treeID : parent.treeID 
            }, { $inc: { rgt: 2 }}, { multi: true }, function(err, numAffectedRows) {
                if(err) {
                    return next(err);
                }

                _this.lft = parent.lft + 1;
                _this.rgt = _this.lft + 1;

                next();
            });
        });
    });    


	schema.pre('save', function(next) {
		var _this = this;

    	if (!this.parentID) {
    		return next();
    	}


    	this.parent(function(err, parent) {
    		if(err) {
    			return next(err);
    		}

            if(_this.lft  && _this.lft === parent.lft+1) {
                _this._prepend(parent, next);
                return;
            }

            _this._append(parent, next);
    	});
    });


    schema.pre('remove', function(next) {
        this.reload(function(err, _this) {
            if(err) {
                return next(err);
            }

            var width = (_this.rgt-_this.lft)+1;

            _this.constructor.remove({
                treeID : _this.treeID,
                lft    : { 
                    $gt: _this.lft,
                    $lt: _this.rgt
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
    });

    schema.method('reload', function(cb) {
        this.constructor.findById(this._id, function(err, obj) {
            if(err) {
                return cb(err);
            }

            cb(null, obj);
        });
    });


    schema.method('append', function(data, cb) {
        this.reload(function(err, _this) {
            data.parentID = _this._id;
            data.treeID = _this.treeID;
            data.deep = _this.deep+1;
            data.lft = _this.rgt;
            data.rgt = data.lft + 1;

            _this.constructor.create(data, cb);
        });
	});

    schema.method('prepend', function(data, cb) {
        this.reload(function(err, _this) {
            data.parentID = _this._id;
            data.treeID = _this.treeID;
            data.deep = _this.deep+1;
            data.lft = _this.lft+1;
            data.rgt = data.lft+1;

            _this.constructor.create(data, cb);
        });
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


    schema.method('tree', function(callback) {
        var tree = {
            node: this,
            children: []
        };

        var ref = {};
        ref[this._id] = tree;

        return this.constructor.find({ 
            lft: { $gt: this.lft },
            rgt: { $lt: this.rgt },
            treeID: this.treeID 
        }).sort('lft').exec(function(err, nodes) {          
            if(err) {
                return callback(err);
            }

            for(var i=0; i<nodes.length; i++) {
                var node = nodes[i],
                    id = node._id,
                    parentID = node.parentID;  

                if(!ref[parentID]) {
                    continue;
                }

                //create reference to actual node
                ref[id] = {
                    node: node,
                    children: []
                };

                ref[parentID].children.push(ref[id]);
            }

            callback(null, tree);
        });
    });
};
