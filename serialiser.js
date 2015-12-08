/**
*  Serialiser.js
*  Parse, serialise and url-encode/decode complex form fields to/from an object model
*
*  @version: 0.3.0
*  https://github.com/foo123/serialiser.js
*
**/
!function( root, name, factory ) {
"use strict";
if ( 'object' === typeof exports )
    // CommonJS module
    module.exports = factory( );
else if ( 'function' === typeof define && define.amd )
    // AMD. Register as an anonymous module.
    define(function( req ) { return factory( ); });
else
    root[name] = factory( );
}(this, 'Serialiser', function( undef ) {
"use strict";

var HAS = 'hasOwnProperty', toString = Object.prototype.toString,
    
    json_encode = JSON.stringify, json_decode = JSON.parse,
    url_encode = encodeURIComponent, url_decode = decodeURIComponent,
    
    ATTR = 'getAttribute', SET_ATTR = 'setAttribute', HAS_ATTR = 'hasAttribute', DEL_ATTR = 'removeAttribute',
    CHECKED = 'checked', DISABLED = 'disabled', SELECTED = 'selected',
    NAME = 'name', TAG = 'tagName', TYPE = 'type', VAL = 'value', 
    OPTIONS = 'options', SELECTED_INDEX = 'selectedIndex', PARENT = 'parentNode',
    STYLE = 'style', CLASS = 'className', HTML = 'innerHTML', TEXT = 'innerText', TEXTC = 'textContent',
    opt_val = function( o ) {
        // attributes.value is undefined in Blackberry 4.7 but
        // uses .value. See #6932
        var val = o.attributes[VAL];
        return !val || val.specified ? o[VAL] : o.text;
    },
    select_get = function( el ) {
        var val, opt, options = el[OPTIONS], sel_index = el[SELECTED_INDEX],
            one = "select-one" === el[TYPE] || sel_index < 0,
            values = one ? null : [],
            max = one ? sel_index + 1 : options.length,
            i = sel_index < 0 ? max : (one ? sel_index : 0)
        ;

        // Loop through all the selected options
        for ( ; i<max; i++ ) 
        {
            opt = options[ i ];

            // oldIE doesn't update selected after form reset (#2551)
            if ( ( opt[SELECTED] || i === sel_index ) &&
                // Don't return options that are disabled or in a disabled optgroup
                ( !opt[DISABLED] ) &&
                ( !opt[PARENT][DISABLED] || "optgroup" !== opt[PARENT][TAG].toLowerCase() ) 
            ) 
            {
                // Get the specific value for the option
                val = opt_val( opt );
                // We don't need an array for one selects
                if ( one ) return val;
                // Multi-Selects return an array
                values.push( val );
            }
        }
        return values;
    },
    get_val = function( el ) {
        if ( !el ) return;
        switch( el[TAG].toLowerCase() )
        {
            case 'textarea':case 'input': return el[VAL];
            case 'select': return select_get( el );
            default: return (TEXTC in el) ? el[TEXTC] : el[TEXT];
        }
    },
    escaped_re = /[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, 
    esc_re = function( s ) { return s.replace(escaped_re, "\\$&"); },
    RE = function( re, fl ) { return new RegExp(re, fl||''); },
    trim_re = /^\s+|\s+$/g,
    trim = String.prototype.trim 
            ? function( s ){ return s.trim( ); } 
            : function( s ){ return s.replace(trim_re, ''); },
    numeric_re = /^\d+$/, index_to_prop_re = /\[([^\]]*)\]/g, dynamic_array_re = /\[\s*\]$/,
    leading_dots_re = /^\.+/g, trailing_dots_re = /^\.+|\.+$/g,
    dotted = function( key ) {
        //        convert indexes to properties     strip leading dots
        return key.replace(index_to_prop_re, '.$1').replace(leading_dots_re, '');
    },
    is_array = function( o ) {
        return '[object Array]' === toString.call(o);
    }
    //rbracket = /\[\s*\]$/
;

function key_getter( at_key, prefix )
{
    if ( "function" === typeof at_key ) return at_key;
    else if ( !!prefix )
    {
        // strict mode (after prefix, a key follows)
        var regex = RE( '^' + esc_re( prefix ) + '([\\.\\[].+)$' );
        return function( el ) { 
            var m, key = el[ATTR]( at_key );
            return !!key && (m=key.match(regex)) ? m[1] : null;
        };
    }
    else
    {
        return function( el ) {
            return el[ATTR]( at_key );
        };
    }
}

function value_getter( at_value, strict )
{
    return "function" === typeof at_value
        ? at_value
        : (false !== strict
        ? function( el ) {
            var value = ('value' === at_value ? get_val( el ) : el[ATTR]( at_value )) || '',
                type = (el[ATTR]('type')||el[TAG]||'').toLowerCase( );
            
            // empty, non-selected, non-checked element, bypass
            return ( (('checkbox' === type || 'radio' === type) && !el[CHECKED]) ||
                ('select' === type && (!value.length || -1 === el[SELECTED_INDEX])) ||
                (('text' === type || 'textarea' === type ) && !trim(value).length)
            ) ? undef : value;
        }
        : function( el ) {
            var value = ('value' === at_value ? get_val( el ) : el[ATTR]( at_value )) || '',
                type = (el[ATTR]('type')||el[TAG]).toLowerCase( );
            return (('checkbox' === type || 'radio' === type) && !el[CHECKED]) ? undef : value;
        });
}

// adapted from ModelView
// http://stackoverflow.com/a/32029704/3591273
function fields2model( $elements, model, $key, $value, $json_encoded, arrays_as_objects )
{
    model = model || {}; $key = key_getter( $key || 'name' ); $value = value_getter( $value || 'value' );
    if ( arguments.length < 5 ) $json_encoded = false;
    arrays_as_objects = true === arrays_as_objects;
    for(var e=0,len=$elements.length; e<len; e++)
    {
        var el = $elements[e], key, value, k, i, o, n, is_dynamic_array = false,
            json_encoded = !!$json_encoded ? !!el[ATTR]($json_encoded) : false
        ;

        key = $key( el ); if ( !key ) continue;
        value = $value( el ); if ( null == value ) continue;
        if ( json_encoded )
        {
            if ( !!value ) value = json_decode( value );
            else value = null;
        }
        
        var is_dynamic_array = dynamic_array_re.test( key );
        k = dotted( key ).split('.'); o = model;
        while ( k.length )
        {
            i = k.shift( );
            if ( k.length ) 
            {
                if ( !o[HAS]( i ) )
                {
                    if ( is_dynamic_array && 1 === k.length ) // dynamic array, ie a[ b ][ c ][ ]
                        o[ i ] = [ ];
                    else if ( !arrays_as_objects && numeric_re.test( k[0] ) ) // standard array, ie a[ b ][ c ][ n ]
                        o[ i ] = new Array( parseInt(k[0], 10)+1 );
                    else // object, associative array, ie a[ b ][ c ][ k ]
                        o[ i ] = { };
                }
                else if ( !arrays_as_objects && numeric_re.test( k[0] ) && (o[i].length <= (n=parseInt(k[0], 10))) )
                {
                    // adjust size if needed to already standard array
                    o[ i ] = o[ i ].concat( new Array(n-o[i].length+1) );
                }
                o = o[ i ];
            }
            else 
            {
                if ( is_dynamic_array ) o.push( value ); // dynamic array, i.e a[ b ][ c ][ ]
                else o[ i ] = value; // i.e a[ b ][ c ][ k ]
            }
        }
    }
    return model;
}
function params2model( q, model, coerce, arrays_as_objects )
{
    model = model || {}; coerce = !!coerce;
    arrays_as_objects = true === arrays_as_objects;
    var coerce_types = { 'true':true, 'false':false, 'null':null, 'undefined':undefined }, 
        params, p, key, value, o, k;

    // Iterate over all name=value pairs.
    params = q.replace(/%20|\+/g, ' ').split('&');
    for (i=0,l=params.length; i<l; i++)
    {
        p = params[i].split( '=' );
        // If key is more complex than 'foo', like 'a[]' or 'a[b][c]', split it
        // into its component parts.
        key = url_decode( p[0] );
        value = p.length > 1 ? url_decode( p[1] ) : (coerce ? undefined : '');
        // Coerce values.
        if ( coerce )
        {
            value = value && !isNaN(value) && ((+value + '') === value)
            ? +value                  // number
            : ('undefined' === typeof value
            ? undefined               // undefined
            : (coerce_types[HAS][value]
            ? coerce_types[value]     // true, false, null, undefined
            : value));                // string
        }
        
        var is_dynamic_array = dynamic_array_re.test( key );
        key = dotted( key ).split('.'); o = model;
        while ( key.length )
        {
            k = key.shift( );
            if ( key.length ) 
            {
                if ( !o[HAS]( k ) )
                {
                    if ( is_dynamic_array && 1 === key.length ) // dynamic array, ie a[ b ][ c ][ ]
                        o[ k ] = [ ];
                    else if ( !arrays_as_objects && numeric_re.test( key[0] ) ) // standard array, ie a[ b ][ c ][ n ]
                        o[ k ] = new Array( parseInt(key[0], 10)+1 );
                    else // object, associative array, ie a[ b ][ c ][ k ]
                        o[ k ] = { };
                }
                else if ( !arrays_as_objects && numeric_re.test( key[0] ) && (o[k].length <= (n=parseInt(key[0], 10))) )
                {
                    // adjust size if needed to already standard array
                    o[ k ] = o[ k ].concat( new Array(n-o[k].length+1) );
                }
                o = o[ k ];
            }
            else 
            {
                if ( is_dynamic_array ) o.push( value ); // dynamic array, i.e a[ b ][ c ][ ]
                else o[ k ] = value; // i.e a[ b ][ c ][ k ]
            }
        }
    }
    return model;
}

function append( q, k, v )
{
    if ( 'function' === typeof v ) v = v( );
    q.push( url_encode( k ) + '=' + url_encode( null == v ? '' : v ) );
}
function build_params( q, o, key )
{
    var k, i, l;

    if ( !!key )
    {
        
        if ( is_array( o ) )
        {
            if ( dynamic_array_re.test( key ) ) /* dynamic array */
                for (i=0,l=o.length; i<l; i++)
                    append( q, key, o[i] );
            else
                for (i=0,l=o.length; i<l; i++)
                    build_params( q, o[i], key + '[' + ('object' === typeof o[i] ? i : '') + ']' );
        }
        else if ( o && ('object' === typeof o) )
        {
            for (k in o) if ( o[HAS](k) ) build_params( q, o[k], key + '[' + k + ']' );
        }
        else
        {
            append( q, key, o );
        }
    }
    else if ( is_array( o ) )
    {
        for (i=0,l=o.length; i<l; i++) append( q, o[i].name, o[i].value );
    }
    else if ( o && ('object' === typeof o) )
    {
        for (k in o) if ( o[HAS](k) ) build_params( q, o[k], key );
    }
    return q;
}
// adapted from https://github.com/knowledgecode/jquery-param
function model2params( model, q, as_array )
{
    var params = build_params( q || [], model || {} );
    if ( true !== as_array ) params = params.join('&').split('%20').join('+');
    return params;
}

function pass( )
{
    return true;
}
function fail( )
{
    return false;
}

// export it
return /*Serialiser = */{
     VERSION: '0.3.0'
    
    // adapted from ModelView
    ,Type: {
        COMPOSITE: function( ) {
            var T = arguments;
            if ( T[ 0 ] && T[ 0 ].concat ) T = T[ 0 ];
            return function( v, k, o, i, vk ) {
               var l = T.length;
               while ( l-- ) v = T[ l ]( v, k, o, i, vk );
               return v;
            };
        },
        DEFAULT: function( defaultValue ) {  
            return function( v ) { 
                if ( null == v || (('[object String]' === toString.call(v)) && !trim(v).length)  ) v = defaultValue;
                return v;
            }; 
        },
        BOOL: function( v ) { 
            // handle string representation of booleans as well
            if ( ('[object String]' === toString.call(v)) && v.length )
            {
                var vs = v.toLowerCase( );
                return "true" === vs || "on" === vs || "yes" === vs || "1" === vs;
            }
            return !!v; 
        },
        INT: function( v ) { 
            return parseInt(v||0, 10)||0;
        },
        FLOAT: function( v ) { 
            return parseFloat(v||0, 10)||0;
        },
        STR: function( v ) { 
            return String(v);
        },
        MIN: function( m ) {  
            return function( v ) {
                return v < m ? m : v;
            };
        },
        MAX: function( M ) {  
            return function( v ) {
                return v > M ? M : v;
            };
        },
        CLAMP: function( m, M ) {  
            if ( m > M ) { var tmp = M; M = m; m = tmp; }
            return function( v ) {
                return v < m ? m : (v > M ? M : v);
            }; 
        }
    }
    // adapted from ModelView
    ,Validator: {
        PASS: pass,
        FAIL: fail,
        NOT: function( V ) {
            return function( v, k, o, i, vk ) {
                return !V( v, k, o, i, vk );
            };
        },
        AND: function( V1, V2 ){
            return function( v, k, o, i, vk ) {
                return V1( v, k, o, i, vk ) && V2( v, k, o, i, vk );
            };
        },
        EITHER: function( V1, V2 ) {
            return function( v, k, o, i, vk ) {
                return V1( v, k, o, i, vk ) || V2( v, k, o, i, vk );
            };
        },
        IIF: function( cond, if_v, else_v ) {
            else_v = else_v || pass;
            return function( v, k, o, i, vk ) {
                return !!cond( v, k, o, i, vk ) ? if_v( v, k, o, i, vk ) : else_v( v, k, o, i, vk );
            };
        },
        REQUIRED: function( v ) {
            var T = toString.call( v );
            return ('[object String]' == T) || ('[object Array]' == T) ? !!v.length : null != v;
        },
        IS: function( field, value, strict ) {
            return true === strict
            ? function( v, k, o ){ return value === o[field]; }
            : function( v, k, o ){ return value == o[field]; }
            ;
        },
        BETWEEN: function( m, M, strict ) {
            if ( m > M ) { var tmp=m; m=M; M=tmp; }
            return true === strict
            ? function( v ){ return v > m && v < M; }
            : function( v ) { return v >= m && v <= M; }
            ;
        },
        MATCHES: function( pattern ) {
            return function( v ) {
               return pattern.test( v );
            };
        },
        EXPRESSION: function( expression ) {
            return new Function('value,key,model,index,model_key', 'return ('+expression+');');
        }
    }
    ,Typecast: function( model, types ) {
        if ( !!types )
        {
            for (var key in types)
            {
                if ( !types[HAS](key) ) continue;
                var T=  types[key];
                if ( '[object Array]' === toString.call( T ) )
                {
                    if ( model[HAS](key) )
                    {
                        var k, m = model[key], n = m.length, T = T[0];
                        for (k=0; k<n; k++) m[k] = T( m[k], key, model, k, m );
                    }
                }
                else
                {
                    model[ key ] = T( model[ key ], key, model );
                }
            }
        }
        return model;
    }
    
    ,Validate: function( model, validators, errors, base ) {
        var ret = true;
        base = base || '';
        if ( !!validators )
        {
            for (var key in validators)
            {
                if ( !validators[HAS](key) ) continue;
                var V = validators[key];
                if ( '[object Array]' === toString.call( V[0] ) )
                {
                    if ( model[HAS](key) )
                    {
                        var v = V[0][0], k, m = model[key], n = m.length, e = new Array(n),
                            invalid = false, v_err = V[1];
                        for (k=0; k<n; k++)
                        {
                            if ( !v( m[ k ], key, model, k, m ) )
                            {
                                e[ k ] = v_err;
                                invalid = true;
                            }                
                        }
                        if ( invalid )
                        {
                            errors[ base + key ] = e;
                            ret = false;
                        }
                    }
                    else
                    {
                        ret = false;
                    }
                }
                else if ( !V[0]( model[ key ], key, model ) )
                {
                    errors[ base + key ] = V[1];
                    ret = false;
                }
            }
        }
        return ret;
    }
    
    ,Key: key_getter
    ,Value: value_getter
    
    ,FieldsToModel: fields2model
    ,ModelToParams: model2params
    ,ParamsToModel: params2model
};

});