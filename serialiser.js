/**
*  Serialiser.js
*  Parse and serialise complex form fields into an object model
*
*  @dependencies: jQuery
*  @version: 0.1.0
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

var $ = jQuery, HAS = 'hasOwnProperty', json_decode = JSON.parse,
    numeric_re = /^\d+$/, index_to_prop_re = /\[([^\]]*)\]/g, leading_dots_re = /^\.+/g, trailing_dots_re = /^\.+|\.+$/g,
    escaped_re = /[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g,
    esc_re = function( s ) { return s.replace(escaped_re, "\\$&"); },
    RE = function( re, fl ) { return new RegExp(re, fl||''); },
    trim_re = /^\s+|\s+$/g,
    trim = String.prototype.trim 
            ? function( s ){ return s.trim( ); } 
            : function( s ){ return s.replace(trim_re, ''); },
    dotted = function( key ) {
        //        convert indexes to properties     strip leading dots
        return key.replace(index_to_prop_re, '.$1').replace(leading_dots_re, '');
    }
;

function prefix_remover( prefix )
{
    if ( !!prefix )
    {
        // strict mode (after prefix, a key follows)
        var regex = RE( '^' + esc_re( prefix ) + '([\\.|\\[])' );
        return function( key ) { 
            return key.replace( regex, '$1' );
        };
    }
    else
    {
        return function( key ) { 
            return key;
        };
    }
}

function key_getter( at_key )
{
    return "function" === typeof at_key
        ? at_key
        : function( $el ) {
            return $el.attr( at_key );
        };
}

function value_getter( at_value, strict )
{
    return "function" === typeof at_value
        ? at_value
        : (false !== strict
        ? function( $el ) {
            var value = ('value' === at_value ? $el.val( ) : $el.attr( at_value )) || '',
                type = ($el.attr('type')||$el[0].tagName||'').toLowerCase( );
            
            // empty, non-selected, non-checked element, bypass
            return ( (('checkbox' === type || 'radio' === type) && !$el[0].checked) ||
                ('select' === type && -1 === $el[0].selectedIndex) ||
                (('text' === type || 'textarea' === type ) && !trim(value).length)
            ) ? undef : value;
        }
        : function( $el ) {
            var value = ('value' === at_value ? $el.val( ) : $el.attr( at_value )) || '',
                type = ($el.attr('type')||$el[0].tagName).toLowerCase( );
            return (('checkbox' === type || 'radio' === type) && !$el[0].checked) ? undef : value;
        });
}

// http://stackoverflow.com/a/32029704/3591273
function fields2model( $elements, model, $key, $value, $json_encoded )
{
    model = nodel || {}; $key = key_getter( $key || 'name' ); $value = value_getter( $value || 'value' );
    if ( arguments.length < 5 ) $json_encoded = 'json-encoded';
    $elements.each(function( ){
        var $el = $(this), json_encoded = !!$json_encoded ? !!$el.attr($json_encoded) : false,
            type, key, value, k, i, o, n;

        key = $key( $el ); if ( !key ) return;
        value = $value( $el ); if ( null == value ) return;
        k = dotted( key ).split('.'); o = model;
        if ( json_encoded )
        {
            if ( !!value ) value = json_decode( value );
            else value = null;
        }
        while ( k.length )
        {
            i = k.shift( );
            if ( k.length ) 
            {
                if ( !o[HAS]( i ) )
                {
                    if ( !trim(k[0]).length ) // dynamic array, ie a[ b ][ c ][ ]
                    {
                        o[ i ] = [ ];
                    }
                    else if ( numeric_re.test( k[0] ) ) // standard array, ie a[ b ][ c ][ n ]
                    {
                        n = parseInt(k[0], 10);
                        o[ i ] = new Array( n+1 );
                    }
                    else // object, associative array, ie a[ b ][ c ][ k ]
                    {
                        o[ i ] = { };
                    }
                }
                else if ( numeric_re.test( k[0] ) && (o[i].length <= (n=parseInt(k[0], 10))) )
                {
                    // adjust size if needed to already standard array
                    o[ i ] = o[ i ].concat( new Array(n-o[i].length+1) );
                }
                o = o[ i ];
            }
            else 
            {
                if ( !trim(i).length ) o.push( value ); // dynamic array, i.e a[ b ][ c ][ ]
                else o[ i ] = value; // i.e a[ b ][ c ][ k ]
            }
        }
    });
    return model;
}

// export it
return /*Serialiser = */{
     VERSION: '0.1.0'
    
    ,getKey: key_getter
    ,getValue: value_getter
    ,toModel: fields2model
};

});