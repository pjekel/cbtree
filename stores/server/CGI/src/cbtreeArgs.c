/****************************************************************************************
*	Copyright (c) 2012, Peter Jekel
*	All rights reserved.
*
*	The Checkbox Tree File Store CGI (cbtreeFileStore) is released under to following
*	license:
*
*	    BSD 2-Clause		(http://thejekels.com/cbtree/LICENSE)
*
*	@author		Peter Jekel
*
****************************************************************************************
*
*	Description:
*
*		This module provides all the functionality to process the HTTP QUERY-STRING
*		parameters. The processing of any parameter takes place AFTER the internal
*		CGI environment is established and uses a set of PHP like functions.
*
*		See modules cbtreeCGI.c and cbtreeTypes.c for additional information.
*
****************************************************************************************/
#ifdef _MSC_VER
	#define _CRT_SECURE_NO_WARNINGS
#endif	/* _MSC_VER */

#include <stdio.h>
#include <stdlib.h>

#include "cbtreeArgs.h"
#include "cbtreeCGI.h"
#include "cbtreeFiles.h"
#include "cbtreeJSON.h"
#include "cbtreeString.h"

// Local prototypes.
static char *_patternToRegExp( char *pcPattern, size_t iSize, char **ppcPCRE );

/**
*	_destroyQueryArgm
*
*		Release all resources associated with a QUERY struct. 
*
*	@param	pQuery			Address QUERY struct.
**/
static void _destroyQueryArgm( QUERY *pQuery )
{
	destroy( pQuery->pcProperty );
	destroy( pQuery->pPCRE );
	destroy( pQuery );
}

/**
*	_destroySortArgm
*
*		Release all resources associated with a SORT struct. 
*
*	@param	pSort			Address SORT struct.
**/
static void _destroySortArgm( SORT *pSort )
{
	destroy( pSort->pcProperty );
	destroy( pSort );
}

/**
*	_getOptionArgs
*
*		Returns the address of an OPTIONS struct with all supported options decoded. 
*		Two types of optional parameters are supported, that is, 'queryOptions' and
*		'options'.
*
*			query-options	:== 'queryOptions' '=' '{' (object (',' object)*))? '}'
*			options			:== 'options' '=' '[' (string (',' string)*)? ']'
*			object			:== '{' (property (',' property)*)? '}'
*			property		:== string ':' value
*			array			:== '[' (value (',' value)*)? ']'
*			value			:== string | number | object | array | 'true' | 'false'
*			string			:== '"' char* '"'
*
*		Example:
*
*			queryOptions={"deep":true, "ignoreCase":false}
*			options=["dirsOnly", "showHiddenFiles"]
*
*	@note:	Strict JSON encoding rules are enforced when decoding parameters.
*
*	@param	pGET			Address of a variable data type. (php style $_GET variable)
*	@param	piResult		Address integer receiving the final result code:
*							HTTP_V_OK, HTTP_V_BAD_REQUEST or HTTP_V_SERVER_ERROR
*
*	@return		On success the address of an OPTIONS struct otherwise NULL
**/
static OPTIONS * _getOptionArgs( DATA *pGET, int *piResult )
{
	OPTIONS	*pOptions;
	DATA	*ptQueryOptions,
			*ptOptions;
			
	if( (pOptions = (OPTIONS *)calloc(1, sizeof(OPTIONS))) )
	{
		if( hasProperty( "options", pGET ) )
		{
			if( (ptOptions = jsonDecode( varGetProperty("options", pGET))) )
			{
				pOptions->bShowHiddenFiles = varInArray("showHiddenFiles", ptOptions);
				pOptions->bDirsOnly		   = varInArray("dirsOnly", ptOptions);
				pOptions->bIconClass	   = varInArray("iconClass", ptOptions);
				pOptions->bDebug		   = varInArray("debug", ptOptions);

				destroy( ptOptions );
			}
			else // Ill formatted JSON array
			{
				*piResult = HTTP_V_BAD_REQUEST;
				destroy( pOptions );
				return NULL;
			}
		}

		if( hasProperty( "queryOptions", pGET ) )
		{
			if( (ptQueryOptions = jsonDecode( varGetProperty("queryOptions", pGET))) )
			{
				pOptions->bIgnoreCase = (bool)varGet( varGetProperty("ignoreCase", ptQueryOptions) );
				pOptions->bDeep		  = (bool)varGet( varGetProperty("deep", ptQueryOptions) );
				pOptions->bLoadAll	  = (bool)varGet( varGetProperty("loadAll", ptQueryOptions) );
				if( pOptions->bLoadAll )
				{
					pOptions->bDeep = true;
				}
				destroy( ptQueryOptions );
			}
			else // Ill formatted JSON object
			{
				*piResult = HTTP_V_BAD_REQUEST;
				destroy( pOptions );
				return NULL;
			}
		}
		*piResult = HTTP_V_OK;	// Success
	}
	else // Out of memory...
	{
		*piResult = HTTP_V_SERVER_ERROR;
	}
	return pOptions;
}

/**
*	_getQueryArgs
*
*		Returns a query object as a linked list of query arguments. Parameter pQueryObj
*		represents the JSON decoded query portion of the HTTP QUERY-STRING. If a query
*		parameter is a pattern string it is converted into a pre-compiled Perl Compatible
*		Regular Expression (PCRE)
*
*	@param	pQueryObj		Address of a DATA struct 
*	@param	pOptions		Address OPTIONS struct.
*	@param	piResult		Address integer receiving the final result code:
*							HTTP_V_OK or HTTP_V_BAD_REQUEST
*
*	@return		Address QUERY struct.
**/
static LIST *_getQueryArgs( DATA *pQueryObj, OPTIONS *pOptions, int *piResult )
{
	LIST		*pQueryList = NULL;
	QUERY		*pQueryArgm;
	DATA		*pProperties,
				*pProperty;

	const char	*pcError;
	char	cPCRE[512];
	char	*pcPCRE = cPCRE,
			*pcProperty;

	int		iPropCount,
			iErrOffset,
			iPropId,
			iOptions,
			i;

	if( !isObject( pQueryObj ) && !isNull( pQueryObj ) )
	{
		*piResult = HTTP_V_BAD_REQUEST;
		return NULL;
	}

	pProperties = varGetProperties( pQueryObj );
	iPropCount  = varCount( pProperties );

	if( iPropCount )
	{
		pQueryList = newList();		// Allocate a new list.
	
		for( i=0; i<iPropCount; i++ )
		{
			pcProperty = varGet( varGetByIndex(i, pProperties) );
			pProperty  = varGetProperty( pcProperty, pQueryObj );

			iPropId = getPropertyId( pcProperty );
			if( iPropId != PROP_V_UNKNOWN )
			{
				if( (pQueryArgm = (QUERY *)calloc(1, sizeof(QUERY))) )
				{
					pQueryArgm->pcProperty  = mstrcpy( pcProperty );
					pQueryArgm->iPropertyId = iPropId;
					pQueryArgm->iDataType   = varGetType( pProperty );
					switch( pQueryArgm->iDataType )
					{
						case TYPE_V_STRING:
							if( _patternToRegExp( varGet( pProperty ), sizeof(cPCRE), &pcPCRE ) )
							{
								iOptions = 0 | (pOptions->bIgnoreCase ? PCRE_CASELESS : 0);
								pQueryArgm->pPCRE = pcre_compile( pcPCRE, iOptions, &pcError, &iErrOffset, NULL );
							}
							else // Invalid or empty pattern string.
							{
								_destroyQueryArgm( pQueryArgm );
								continue;
							}
							break;
						case TYPE_V_BOOLEAN:
							pQueryArgm->value.bBoolean = (bool)varGet( pProperty );
							break;
						default:
							break;
					}
					insertTail( pQueryArgm, pQueryList );
				}
			}
		}
	}
	destroy( pProperties );
	*piResult = HTTP_V_OK;

	return pQueryList;
}

/**
*	_getSortArgs
*
*		Returns the sort request parameter as a linked list of SORT structs.
*		The sort request parameter is formatted as follows:
*
*			sort-object :== 'sort' '=' '[' (object (',' object)*)? ']'
*
*		Example:
*
*			sort=[{"attribute":"directory", "descending":true}, {"attribute":"path", "ignoreCase":true}]
*
*	@param	pSortObj		Address DATA struct containing a sort-object.
*	@param	pOptions		Address OPTIONS struct containing the 'global' options.
*	@param	piResult		Address integer receiving the final result code:
*							HTTP_V_OK or HTTP_V_BAD_REQUEST
**/
static LIST * _getSortArgs( DATA *pSortObj, OPTIONS *pOptions, int *piResult )
{
	DATA	*pDescending,
			*pIgnoreCase,
			*pAttribute,
			*pSortSpec;
	LIST	*pSortList = NULL;
	SORT	*pSort = NULL;
	int		iSortArgs,
			iPropId,
			i;
	
	if( !isArray( pSortObj ) && !isNull( pSortObj ) )
	{
		*piResult = HTTP_V_BAD_REQUEST;
		return NULL;
	}
	
	if( (iSortArgs = varCount( pSortObj )) )
	{
		pSortList = newList();		// Allocate a new list.
		for( i=0; i<iSortArgs; i++ )
		{
			pSortSpec   = varGetByIndex( i, pSortObj );
			pAttribute  = varGetProperty("attribute", pSortSpec);
			pDescending = varGetProperty("descending", pSortSpec);
			pIgnoreCase = varGetProperty("ignoreCase", pSortSpec);

			if( (pAttribute && isString(pAttribute)) && (pDescending && isBool(pDescending)) )
			{
				iPropId = getPropertyId( varGet( pAttribute ));
				if( iPropId != -1 )
				{
					if( (pSort = (SORT *)calloc(1, sizeof(SORT))) )
					{
						pSort->pcProperty  = mstrcpy(varGet( pAttribute ));
						pSort->bDescending = (bool)varGet( pDescending );
						pSort->bIgnoreCase = pIgnoreCase ? (bool)varGet( pIgnoreCase ) : 
														   (bool)pOptions->bIgnoreCase;
						pSort->iPropertyId = iPropId;

						insertTail( pSort, pSortList );
					}
					else // Out of memory
					{
						destroyList( &pSortList, _destroySortArgm );
						*piResult = HTTP_V_SERVER_ERROR;
						return NULL;
					}
				}
			}
		}
	}
	*piResult = HTTP_V_OK;
	return pSortList;
}

/**
*	patterToRegExp
*
*		Convert a pattern string to a Perl Compatible Regular Expression (PCRE).
*
*	@param	pcPattern		Address C-string containing the pattern string
*	@param	iSize			Size of the output buffer pointed to by ppcPCRE.
*	@param	ppcPCRE			Address of a pointer of type char identifying the buffer 
*							receiving the 'Perl Compatible Regular Expression'.
*
*	@return		Address C-string containing the PCRE string or NULL if no 
*				pattern was provided.
**/
static char *_patternToRegExp( char *pcPattern, size_t iSize, char **ppcPCRE )
{
	char	cPattern[256];
	char	*src = pcPattern,
			*dst = cPattern;
			
	if( (ppcPCRE && *ppcPCRE) && (pcPattern && *pcPattern) )
	{
		while( *src ) 
		{
			switch( *src ) 
			{
				case '\\':
					*dst++ = *src++;
					*dst++ = *src;
					break;
				case '*':
					*dst++ = '.';
					*dst++ = '*';
					break;
				case '?':
					*dst++ = '.';
					break;
				case '$':
				case '^':
				case '/':
				case '+':
				case '.':
				case '|':
				case '(':
				case ')':
				case '{':
				case '}':
				case '[':
				case ']':
					*dst++ = '\\';
					/* NO BREAK HERE */
				default:
					*dst++ = *src;
					break;
			}
			src++;
		}
		*dst++ = '\0';
		
		snprintf( *ppcPCRE, iSize, "(^%s$)", cPattern );
		return *ppcPCRE;
	}
	return NULL;
}

/**
*	destroyArguments
*
*		Release all resources associated with a struct of type ARGS
*
*	@param	ppArgs			Address of a pointer of type ARGS
**/
void destroyArguments( ARGS **ppArgs )
{
	if( ppArgs && *ppArgs )
	{
		destroyList( &(*ppArgs)->pQueryList, _destroyQueryArgm );
		destroyList( &(*ppArgs)->pSortList, _destroySortArgm );
		destroy( (*ppArgs)->pOptions );

		destroy( *ppArgs );
		*ppArgs = NULL;
	}
}

/**
*	getArguments
*
*		Returns the address of an ARGS struct with all HTTP query string parameters
*		extracted and decoded. The query string parameters (args) supported are:
*
*			query-string  ::= (qs-param ('&' qs-param)*)?
*			qs-param	  ::= basePath | path | query | queryOptions | options | 
*							  start | count |sort
*			basePath	  ::= 'basePath' '=' path-rfc3986
*			path		  ::= 'path' '=' path-rfc3986
*			query		  ::= 'query' '=' object
*			query-options ::= 'queryOptions' '=' object
*			options		  ::= 'options' '=' array
*			start		  ::= 'start' '=' number
*			count		  ::= 'count' '=' number
*			sort		  ::= 'sort' '=' array
*
*	@note:	All of the above parameters are optional.
*
*	@param	piResult		Address integer receiving the final result code:
*							HTTP_V_OK, HTTP_V_BAD_REQUEST or HTTP_V_SERVER_ERROR
*
*	@return		On success the address of an ARGS struct otherwise NULL
**/
ARGS *getArguments( int *piResult )
{
	ARGS	*pArgs;
	DATA	*pGET = NULL;
	DATA	*ptQuery,
			*ptSort,
			*ptArg;
	int		iResult = HTTP_V_OK;	// Assume success
	
	if( (pArgs = (ARGS *)calloc(1, sizeof(ARGS))) )
	{
		if( (pGET = cgiGetProperty( "_GET" )) )
		{
			// Parse the general options, if any..
			if( !(pArgs->pOptions = _getOptionArgs( pGET, &iResult )) )
			{
				destroyArguments( &pArgs );
				return NULL;
			}
			if( (ptArg = varGetProperty("basePath", pGET)) && isString( ptArg ) )
			{
				pArgs->pcBasePath = varGet( ptArg );
			}
			if( (ptArg = varGetProperty("path", pGET)) && isString( ptArg ) )
			{
				pArgs->pcPath = varGet( ptArg );
			}
			if( (ptArg = varGetProperty("start", pGET)) && isInteger( ptArg ) )
			{
				pArgs->iStart = (int)varGet( ptArg );
			}
			if( (ptArg = varGetProperty("count", pGET)) && isInteger( ptArg ) )
			{
				pArgs->iCount = (int)varGet( ptArg );
			}

			if( iResult == HTTP_V_OK )
			{
				// Parse the 'query' specifications, if any..
				if( hasProperty( "query", pGET ) )
				{
					if( (ptQuery = jsonDecode(varGetProperty("query", pGET)) )  )
					{
						pArgs->pQueryList = _getQueryArgs( ptQuery, pArgs->pOptions, &iResult );
						destroy( ptQuery );
					}
					else // Invalid query format (not a JSON object)
					{
						iResult = HTTP_V_BAD_REQUEST;
					}
				}
			}
			if( iResult == HTTP_V_OK )
			{
				// Parse the 'sort' specifications, if any..
				if( hasProperty( "sort", pGET ) )
				{
					if( (ptSort = jsonDecode( varGetProperty("sort", pGET) )) )
					{
						pArgs->pSortList = _getSortArgs( ptSort, pArgs->pOptions, &iResult );
						destroy( ptSort );
					}
					else
					{
						iResult = HTTP_V_BAD_REQUEST;
					} 
				}
			}
			if( iResult != HTTP_V_OK )
			{
				destroyArguments( &pArgs );
				*piResult = iResult;
				return NULL;
			}
		}
		else // No QUERY-STRING
		{
			// We need at least an empty options struct.
			pArgs->pOptions = _getOptionArgs( NULL, &iResult ); 
		}
		*piResult = HTTP_V_OK;
	}
	else  // Out of memory
	{
		*piResult = HTTP_V_SERVER_ERROR;
	}
	return pArgs;
}
