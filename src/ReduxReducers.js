import encode from './encode';
import ParseFile from './ParseFile';
import ParseObject from './ParseObject';
import ParseRelation from './ParseRelation';
import { combineReducers } from 'redux';
import { getItemState, setItemState } from './ReduxCacheHelper';

const Objects = {
	INITIALIZE_STATE(objectState, {className, id, initial}) {
	  objectState = {...objectState};
	  if (!objectState[className]) {
	    objectState[className] = {};
	  } else {
	  	objectState[className] = {...objectState[className]};
	  }

	  if (!initial) {
	    initial = {
	      serverData: {},
	      pendingOps: [{}],
	      objectCache: {},
	      // tasks: new TaskQueue(),
	      existed: false
	    };
	  }
	  objectState[className][id] = initial;
	  return objectState;
	},
	REMOVE_STATE(objectState, {className, id}) {
	  objectState = {...objectState};
	  objectState[className] = {...objectState[className]};
	  delete objectState[className][id];
	  return objectState;
	},
	SET_SERVER_DATA(objectState, {className, id, attributes}) {
		objectState = {...objectState};
		objectState[className] = {...objectState[className]};
		objectState[className][id] = {...objectState[className][id]};
		var data = objectState[className][id].serverData = {...objectState[className][id].serverData};

	  for (var attr in attributes) {
	    if (typeof attributes[attr] !== 'undefined') {
	      data[attr] = attributes[attr];
	    } else {
	      delete data[attr];
	    }
	  }

	  return objectState;
	},
	SET_PENDING_OP(objectState, {className, id, attr, op}) {
		objectState = {...objectState};
		objectState[className] = {...objectState[className]};
		objectState[className][id] = {...objectState[className][id]};
		var pending = objectState[className][id].pendingOps = [...objectState[className][id].pendingOps];
	  var last = pending[pending.length - 1] = {...pending[pending.length - 1]};

	  if (op) {
	    last[attr] = op;
	  } else {
	    delete last[attr];
	  }

	  return objectState;
	},
	CLEAR_PENDING_OPS(objectState, {className, id, attr, op}) {
		objectState = {...objectState};
		objectState[className] = {...objectState[className]};
		objectState[className][id] = {...objectState[className][id]};
		objectState[className][id].pendingOps = [{}];

		return objectState;
	},
	PUSH_PENDING_STATE(objectState, {className, id}) {
		objectState = {...objectState};
		objectState[className] = {...objectState[className]};
		objectState[className][id] = {...objectState[className][id]};
		var pending = objectState[className][id].pendingOps = [...objectState[className][id].pendingOps];

		pending.push({});

		return objectState;
	},
	POP_PENDING_STATE(objectState, {className, id}) {
		objectState = {...objectState};
		objectState[className] = {...objectState[className]};
		objectState[className][id] = {...objectState[className][id]};
		var pending = objectState[className][id].pendingOps = [...objectState[className][id].pendingOps];

	  pending.shift();
	  if (!pending.length) {
	    pending[0] = {};
	  }

	  return objectState;
	},
	MERGE_FIRST_PENDING_STATE(objectState, {className, id}) {
		objectState = {...objectState};
		objectState[className] = {...objectState[className]};
		objectState[className][id] = {...objectState[className][id]};
		var pending = objectState[className][id].pendingOps = [...objectState[className][id].pendingOps];

		var first = pending.shift();
	  var pending;
	  var next = pending[0] = {...pending[0]};
	  for (var attr in first) {
	    if (next[attr] && first[attr]) {
	      var merged = next[attr].mergeWith(first[attr]);
	      if (merged) {
	        next[attr] = merged;
	      }
	    } else {
	      next[attr] = first[attr];
	    }
	  }

		return objectState;
	},
	COMMIT_SERVER_CHANGES(objectState, {className, id, changes}) {
		objectState = {...objectState};
		objectState[className] = {...objectState[className]};
		objectState[className][id] = {...objectState[className][id]};
		var serverData = objectState[className][id].serverData = {...objectState[className][id].serverData};
		var objectCache = objectState[className][id].objectCache = {...objectState[className][id].objectCache};

	  for (var attr in changes) {
	    var val = changes[attr];
	    serverData[attr] = val;
	    if (val &&
	      typeof val === 'object' &&
	      !(val instanceof ParseObject) &&
	      !(val instanceof ParseFile) &&
	      !(val instanceof ParseRelation)
	    ) {
	      var json = encode(val, false, true);
	      objectCache[attr] = JSON.stringify(json);
	    }
	  }

		return objectState;
	},
	_CLEAR_ALL_STATE() {
		return {};
	},
	_SET_EXISTED(objectState, {className, id, existed}) {
		objectState = {...objectState};
		objectState[className] = {...objectState[className]};
		var myObject = objectState[className][id] = {...objectState[className][id]};

		myObject.existed = existed;

		return objectState;
	}
}

const Cloud = {
	SET_PENDING(state, payload) {
		var value = getItemState(state, payload);
		if (value.pending === true)
			console.error('Cloud Code function ' + payload.name + ' is pending.');

		value = {...value};
		value.pending = true;

		return setItemState(state, payload, value);
	},
	UNSET_PENDING(state, payload) {
		var value = getItemState(state, payload);
		if (value.pending === false)
			console.error('Pending already set to false on ' + payload.name + '.');

		value = {...value};
		value.pending = false;

		return setItemState(state, payload, value);
	},
	SAVE_RESULT(state, payload) {
		var value = {
			cache: payload.result,
			pending: false
		};

		return setItemState(state, payload, value);
	},
	OPERATE_ON_ARRAY(state, payload) {
		var value = getItemState(state, payload);
		if (value.pending === false)
			console.error('Pending already set to false on ' + payload.name + '.');

		var result = payload.result;
		if (!Array.isArray(result))
			console.warn('Attempted to append a non-array value on ' + payload.name + '.');

		var cache = value.cache ? [...value.cache] : [];
		var operation = payload.operation;

		cache[operation](...result);

		value = {
			cache,
			pending: false
		};

		return setItemState(state, payload, value);
	},
	ESTIMATE_END_OF_RESULTS(state, payload) {
		var value = getItemState(state, payload);
		var { limit, length, operation } = payload;
		
		var opname;
		switch (operation) {
			case 'appendResult':
				opname = 'append';
				break;
			case 'prependResult':
				opname = 'prepend';
				break;
		}
		var endName = opname + 'End';
		var endOfResults = false;

		if (limit != length)
			endOfResults = true;

		if (value[endName] !== endOfResults)
		{
			value = {...value};
			value[endName] = endOfResults;
			state = setItemState(state, payload, value);
		}

		return state;
	}
}

const User = {
	SET(state, payload) {
		state = {...state};
		state.current = payload && {id: payload.id};

		return state;
	}
}

export function generateReducers(_reducers, _namespace, defaultState) {
	var reducers = {};

	for (let name in _reducers) {
		let reducer = _reducers[name];

		reducers[name] = function(state = defaultState, action) {
			var [ namespace, handlerName, type ] = action.type.split('/')

			if (namespace == _namespace && handlerName == name && reducer[type])
				return reducer[type](state, action.payload);
			return state;
		}
	}
	
	return reducers;
}

function generateParseReducers(_reducers) {
	var reducers = generateReducers(_reducers, 'Parse', {});

	return function(state = {}, action) {
		// clear state if user logs out
		if (action.type == 'Parse/User/SET' && (state.User && state.User.current) && action.payload === null)
			return combineReducers(reducers)({}, action);
		
		return combineReducers(reducers)(state, action);
	}
}

const Query = Cloud;

export default generateParseReducers({
	'Object': Objects,
	Cloud,
	Query,
	User
});