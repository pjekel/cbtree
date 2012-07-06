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
*	@date		07/01/2012
*
*	@version	1.0
*
*	@note		See external dependencies below.
*
*	History:
*
*		1.0		07/01/12	Initial release
*
****************************************************************************************
*
*	Description:
*
*		This file contains the main entry point for the server side CGI application
*		required to enable the dojo cbtreeFileStore and is part of the github project
*		'cbtree'.
*
*		Please refer to http://datatracker.ietf.org/doc/rfc3875/ for the CGI Version 1.1
*		specification.
*
*		The cbtreeFileStore CGI application is invoked by means of a HTTP GET request,
*		the basic ABNF format of a request looks like:
*
*			HTTP-GET 	  ::= uri ('?' query-string)?
*			query-string  ::= (qs-param ('&' qs-param)*)?
*			qs-param	  ::= basePath | path | query | queryOptions | options | 
*							  start | count | sort
*			basePath	  ::= 'basePath' '=' path-rfc3986
*			path		  ::= 'path' '=' path-rfc3986
*			query		  ::= 'query' '=' json-object
*			query-options ::= 'queryOptions' '=' json-object
*			options		  ::= 'options' '=' json-array
*			start		  ::= 'start' '=' number
*			count		  ::= 'count' '=' number
*			sort		  ::= 'sort' '=' json-array
*
*		Please refer to http://json.org for the correct JSON encoding of the
*		parameters.
*
****************************************************************************************
*
*	QUERY-STRING Parameters:
* 
*		basePath:
*
*			The basePath parameter is a URI reference (rfc 3986) relative to the server's
*			document root used to compose the root directory as follows:
*
*				root-dir ::= document_root '/' basePath?
*
*		path:
*
*			The path parameter is used to specify a specific location relative to the
*			above mentioned root_dir. Therfore, the full search path is:
*
*				full-path = root_dir '/' path?
*
*		query:
*
*			The query parameter is a JSON object with a set of JSON 'property:value'
*			pairs. If specified, only files that match the query criteria are returned.
*			If the property value is a string it is treated as a pattern string.
*
*				query={"name":"*.js"}
*
*		queryOptions:
*
*			The queryOptions parameter specifies a set of JSON 'property:value' pairs
*			used during the file search. Currently two properties are supported: "deep"
*			and "ignoreCase". Property deep indicates if a recursive search is required
*			whereas ignoreCase indicates if values are to be compared case insensitive/
*
*				queryOptions={"deep":true, "ignorecase":true}
*
*		options:
*
*			The options parameter is a JSON array of strings. Each string specifying a
*			search options to be enabled. Currently two options are supported: "dirsOnly"
*			and "showHiddenFiles".
*
*				options=["dirsOnly", "showHiddenFiles"]
*
*		start:
*
*			The start parameter identifies the first entry in the files list to be returned
*			to the caller. The default is 0. Note: start is a zero-based index.
*
*		count:
*
*			Parameter count specifies the maximum number of files to be returned. If zero
*			(default) all files, relative to the start position, are returned.
*
*		sort:
*
*			Parameter sort is a JSON array of JSON objects. If specified the files list
*			is sorted in the order the JSON objects are arranged in the array.
*			The properties allowed are: "attribute", "descending" and "ignoreCase". Each
*			sort field object MUST have the "attribute" property defined.
*
*				sort=[{"attribute":"directory", "descending":true},{"attribute":"name"}]
*
*			The example sort will return the file list with the directories first and
*			all names in ascending order. (A typical UI file tree).
*
****************************************************************************************
*
*	RESPONSE:
*
*		Assuming a valid HTTP GET request was received the response to the client
*		complies with the following ABNF notation:
*
*			response	::= '[' totals ',' status ',' file-list ']'
*			totals 		::= '"total"' ':' number
*			status		::= '"status"' ':' status-code
*			status-code	::=	'200' | '204'
*			file-list	::= '"items"' ':' '[' file-info* ']'
*			file-info	::= '{' name ',' path ',' size ',' modified ',' directory 
*							(',' children ',' expanded)? '}'
*			name		::= '"name"' ':' json-string
*			path		::= '"path"' ':' json-string
*			size		::= '"size"' ':' number
*			modified	::= '"modified"' ':' number
*			directory	::= '"directory"' ':' ('true' | 'false')
*			children	::= '[' file-info* ']'
*			expanded	::= '"_EX"' ':' ('true' | 'false')
*			number		::= DIGIT+
*			DIGIT		::= '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
*
*	Notes:
*
*		-	The file-info path is returned as a so-called rootless path, that is,
*			without a leading dot and forward slash. (see rfc-3986 for details).
*		-	The expanded property indicates if a deep search was performed on a 
*			directory. Therefore, if expanded is true and children is empty we
*			are dealing with an empty directory and not a directory that hasn't
*			been searched/expanded yet. The expanded property is typically used
*			when lazy loading the file store.
*
****************************************************************************************
*
*	PERFORMACE:
*
*		If you plan on using the cbtreeFileStore on large file systems with, for
*		example, a checkbox tree  that requires a strict parent-child elationship
*		it is highly recommended to use this ANSI-C implementation instead of the
*		PHP version.
*
*		To configure an Apache HTTP server for CGI support please refer to:
*
*			http://httpd.apache.org/docs/2.2/howto/cgi.html
*
*	NOTE:	When using this CGI implementation no PHP server support is required.
*
****************************************************************************************
*
*	SECURITY:
*
*		Some  basic security issues are addressed  by this implementation.   For example,
*		only HTTP GET requests are served. In addition, malformed QUERY-STRING parameters
*		are NOT skipped and ignored, instead they will result in a 'Bad Request' response
*		to the server/client.   Requests to access files above the server's document root
*		are rejected returning the HTTP forbidden response (403).
*
*	NOTE:	This implementation will not list any files starting with a dot like .htaccess
*			unless explicitly requested. However it will NOT process .htaccess files either.
*			Therefore, it is the user's responsibility not to include any private or other
*			hidden files in the directory tree accessible to this application.
*
****************************************************************************************
*
*	EXTERNAL DEPENDENCIES:
*
*		To build this CGI application you must either have or get the PCRE 'Perl
*		Compatible Regular Expression' library. The library can be found at:
*
*			http://www.pcre.org/
*
*		The PCRE directory includes a Microsoft Windows PCRE DLL and associated link
*		library version 8.10 for your conveniance.
*
***************************************************************************************/
#ifdef _MSC_VER
	#define _CRT_SECURE_NO_WARNINGS
#endif	/* _MSC_VER */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "cbtreeArgs.h"
#include "cbtreeCGI.h"
#include "cbtreeURI.h"
#include "cbtreeJSON.h"
#include "cbtreeString.h"
#include "cbtreeFiles.h"
#include "cbtreeDebug.h"

#define	STORE_C_IDENTIFIER	"path"
#define STORE_C_LABEL		"name"

static char	cDbgServer[] = "d:/MyServer/html/";		// For debug purpose only.

extern FILE	*phResp;		// File handle output stream. (set by cgiInit() )

/**
*	main
*
*		Main entry point Common Gateway Interface (CGI) application.
*
**/
int main()
{
	ARGS	*pArgs = NULL;
	LIST	*pFileList,
			*pSlice;
	
	char	cDocRoot[MAX_PATH_SIZE]   = "",
			cRootDir[MAX_PATH_SIZE]   = "",
			cFullPath[MAX_PATH_SIZE]  = "",
			cPathEnc[MAX_PATH_SIZE*2] = "";			
	char	*pcResult;
	int		iMaskJSON = 0,
			iResult;
	
	cgiInit();		// Initialize the CGI environment.

#ifdef _DEBUG	// Inject some variables...
	varSet( cgiGetProperty("DOCUMENT_ROOT"), cDbgServer );
	varSet( cgiGetProperty("REQUEST_METHOD"), "GET" );
#endif

	// This CGI application ONLY serves HTTP GET requests, anything else will
	// be rejected.
	if( cgiGetMethod() == HTTP_V_GET )
	{
		// Get the application specific arguments and options.
		if( !(pArgs = getArguments( &iResult )) )
		{
			switch( iResult )
			{
				case HTTP_V_BAD_REQUEST:
				case HTTP_V_SERVER_ERROR:
					cgiFailed( iResult, NULL );
					break;
				default:
					cgiFailed( iResult, "Undetermined error condition" );
					break;
			}
			return 0;
		}
	}
	else // Not a HTTP GET request method.
	{
		cgiFailed( HTTP_V_METHOD_NOT_ALLOWED, NULL );
		cbtDebug( "Invalid method: %d", cgiGetMethod() );
		return 0;
	}
	/*
		Compose and normalize the root directory and full path.   Any path is handled
		as a URI path as described in RFC 3986. The path argument in the QUERY-STRING
		must  comply with the either  the path-absolute, path-noscheme  or path-empty
		format. Any pathname returned to the caller is of type path-noscheme, that is,
		it begins with a non-colon segment (e.g no leading '/').
	*/

	if( varGet( cgiGetProperty( "DOCUMENT_ROOT" )) == NULL )
	{
		cgiFailed( HTTP_V_SERVER_ERROR, "CGI environment variables missing." );
		cbtDebug( "No DOCUMENT_ROOT available." );
		return 0;
	}
	snprintf( cDocRoot, sizeof(cDocRoot)-1, "%s/", varGet( cgiGetProperty( "DOCUMENT_ROOT" )) );
	strtrim( normalizePath( cDocRoot ), TRIM_M_WSP );
	snprintf( cRootDir, sizeof(cRootDir)-1, "%s%s/", cDocRoot, (pArgs->pcBasePath ? pArgs->pcBasePath : "") );
	strtrim( normalizePath( cRootDir ), TRIM_M_WSP );

	snprintf( cFullPath, sizeof(cFullPath)-1, "%s%s", cRootDir, (pArgs->pcPath ? pArgs->pcPath : "*") );
	strtrim( normalizePath( cFullPath ), TRIM_M_SLASH );

	// Make sure the caller is not backtracking by specifying paths like '../../../../'
	if( !strncmp( cDocRoot, cRootDir, strlen(cDocRoot)) &&
		!strncmp( cRootDir, cFullPath, strlen(cRootDir)) )
	{
		if( !pArgs->pcPath )
		{
			if( pArgs->pQueryList ) 
			{
				pFileList = getMatch( cFullPath, cRootDir, pArgs, &iResult );
			}
			else // No query parameters
			{
				pFileList = getDirectory( cFullPath, cRootDir, pArgs, &iResult );
			}
		}
		else // A specific path is specified.
		{
			pFileList = getFile( cFullPath, cRootDir, pArgs, &iResult );
		}

		if( pFileList )
		{
			pSlice     = fileSlice( pFileList, pArgs->iStart, pArgs->iCount );
			iResult    = listIsEmpty( pSlice ) ? HTTP_V_NO_CONTENT : HTTP_V_OK;
			iMaskJSON |= pArgs->pOptions->bIconClass ? JSON_M_INCLUDE_ICON : 0;

			if( (pcResult = jsonEncode(pSlice, iMaskJSON)) )
			{
				// Write the header(s)
				fprintf( phResp, "Content-Type: text/json\r\n" );
				fprintf( phResp, "\r\n" );
				// Write the body
				fprintf( phResp, "{\"identifier\":\"%s\",\"label\":\"%s\", \
								   \"total\":%d,\"status\":%d,\"items\":%s}\r\n", 
						 STORE_C_IDENTIFIER, STORE_C_LABEL, fileCount(pSlice, false), iResult, pcResult );
				destroy( pcResult );
			}
			else
			{
				cgiFailed( HTTP_V_SERVER_ERROR, "JSON encoding failed" );
			}
			destroyFileList( &pFileList );	// Destroy list AND associated FILE_INFO.
			destroyList( &pSlice, NULL );	// Destroy list only.
		}
		else
		{
			if( iResult != HTTP_V_NOT_FOUND )
			{
				fprintf( phResp, "Content-Type: text/json\r\n" );
				fprintf( phResp, "\r\n" );

				fprintf( phResp, "{\"identifier\":\"%s\",\"label\":\"%s\", \
								   \"total\":%d,\"status\":%d,\"items\":[]}\r\n", 
						 STORE_C_IDENTIFIER, STORE_C_LABEL, iResult );
			}
			else
			{
				// Don't give away more than is needed....
				encodeReserved( pArgs->pcBasePath, cPathEnc, sizeof(cPathEnc)-1 );
				cgiFailed( HTTP_V_NOT_FOUND, cPathEnc );
			}
		}
	}
	else // Somebody is being naughty....
	{
		/*
			If we get here the caller specified either a base path or path that, after
			normalization, resulted in a directory ABOVE the document root.
		*/
		cgiFailed( HTTP_V_FORBIDDEN, "We're not going there." );
	}
	destroyArguments( &pArgs );
	cgiCleanup();
	return 0;
}
