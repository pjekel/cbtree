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
*		This module holds all non-portable Operating System specific source code. 
*		To implement the CGI application for any OS other than Microsoft Windows
*		you must provide the following four functions:
*
*			1 - _fileToStruct	(Convert OS specific file info to a generic format).
*			2 -	findFile		(Find the first file in a search sequence.)
*			3 -	findNextFile	(Find the next file in a search sequence.)
*			4 - findEnd			(File search completion.)
*		
*		All other modules, part of this CGI implementation, are OS independent.
*
****************************************************************************************/
#ifdef _MSC_VER
	#define _CRT_SECURE_NO_WARNINGS
#endif	/* _MSC_VER */

#include <stdio.h>
#include <stdlib.h>
#include <time.h>

#include "cbtree_NP.h"
#include "cbtreeString.h"

#ifdef WIN32
/**
*	_fileTimeToTime
*
*		Convert Windows FILETIME to Unix time (seconds since Jan 1, 1970)
*
*	@param	pFileTime		Address Windows FILETIME struct.
*
*	@return		Unix time as time_t	
**/
static time_t _fileTimeToTime( FILETIME *pFileTime )
{
	ULARGE_INTEGER	ulBaseTime = { 3577643008UL, 27111902UL },	// FILETIME Jan 1 1970
					ulFileTime;
	time_t	ftime;

	memcpy( &ulFileTime, pFileTime, sizeof(ULARGE_INTEGER));
	ftime = (time_t)((ulFileTime.QuadPart - ulBaseTime.QuadPart) / 10000000);

	return ftime;
}
#endif /* WIN32 */

/**
*	_fileToStruct
*
*		Convert an OS specific file structure to the cbtreeFileStore FILE_INFO struct.
*
*	@param	pcFullPath		Address C-string containing the full directory path.
*	@param	pcRootDir		Address C-string containing the root directory.
*	@param	pvFileData		Address OS specific file info structure.
*
*	@return		On sucess, pointer to a FILE_INFO struct otherwise NULL
**/
static FILE_INFO *_fileToStruct( char *pcFullPath, char *pcRootDir, void *pvFileData )
{
#ifdef WIN32
	WIN32_FIND_DATA	*psFileData = (WIN32_FIND_DATA *)pvFileData;
	FILE_INFO		*pFileInfo = NULL;
	char			cRelPath[MAX_PATH_SIZE],
					*pcRelPath = cRelPath;
		
	if( (pFileInfo = (FILE_INFO *)calloc(1, sizeof(FILE_INFO))) )
	{
		getRelativePath( pcFullPath, pcRootDir, psFileData->cFileName, &pcRelPath );
		
		pFileInfo->pcName		= mstrcpy( psFileData->cFileName );
		pFileInfo->pcPath		= mstrcpy( cRelPath );
		pFileInfo->directory	= (psFileData->dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) ? 1: 0;
		pFileInfo->bIsHidden	= (psFileData->dwFileAttributes & FILE_ATTRIBUTE_HIDDEN) ? 1: 0;
		pFileInfo->lSize		= psFileData->nFileSizeLow;
		pFileInfo->lModified	= (long)_fileTimeToTime( &psFileData->ftLastWriteTime );
	}
	return pFileInfo;
#else
	#error Function _fileToStruct() not implemented
	return NULL;
#endif /* WIN32 */
}

/**
*	findFile
*
*		Locate and return the first file entry matching the full path name. Parameter
*		pvOsArgm offers the ability to return any OS specific information to the caller.
*		In case	of Microsoft Windows, if parameter pvOsArgm is not NULL, the search handle
*		returned by FindFirstFile() is stored at the address pointing to by pvOsArgm.
*		The value of the handle must be passed as an argument to all subsequent calls
*		to findNextFile().
*
*	@param	pcFullPath		Address C-string containing the full directory path.
*	@param	pcRootDir		Address C-string containing the root directory.
*	@param	pvOsArgm		Address of an OS specific argument returned to the caller.
*	@param	piResult		Address of an integer recieving the result code
*							HTTP_V_OK or HTTP_V_NOT_FOUND.
*
*	@return		On sucess, pointer to a FILE_INFO struct otherwise NULL
**/
FILE_INFO *findFile( char *pcFullPath, char *pcRootDir, void *pvOsArgm, int *piResult )
{
#ifdef WIN32
	WIN32_FIND_DATA	sFileData;
	FILE_INFO		*pFileInfo = NULL;
	HANDLE			handle;	

	handle = FindFirstFile( pcFullPath, &sFileData );
	if( handle != INVALID_HANDLE_VALUE )
	{
		pFileInfo = _fileToStruct( pcFullPath, pcRootDir, &sFileData );
		*piResult = HTTP_V_OK;
		if( pvOsArgm ) {
			*((HANDLE *)pvOsArgm) = handle;
		} else {
			findEnd( &handle );
		}
	}
	else
	{
		*piResult = HTTP_V_NOT_FOUND;
	}
	return pFileInfo;
#else
	#error Function findFile() not implemented
	return NULL;
#endif /* WIN32 */
}

/**
*	findNextFile
*
*		Continues a file search from a previous call to the findFile() function.
*		
*	@param	pcFullPath		Address C-string containing the full directory path.
*	@param	pcRootDir		Address C-string containing the root directory.
*	@param	pvOsArgm		Address OS specific argument, if any
*
*	@return		On sucess, pointer to a FILE_INFO struct otherwise NULL
**/
FILE_INFO *findNextFile( char *pcFullPath, char *pcRootDir, void *pvOsArgm )
{
#ifdef WIN32
	WIN32_FIND_DATA	sFileData;

	if( pvOsArgm )
	{
		if( FindNextFile( *((HANDLE *)pvOsArgm), &sFileData ) )
		{
			return _fileToStruct( pcFullPath, pcRootDir, &sFileData );
		}
	}
	return NULL;
#else
	#error Function findNextFile() not implemented
	return NULL;
#endif /* WIN32 */

}

/**
*	findEnd
*
*		Terminate the file search. In case of Microsoft Windows the stream associated
*		with the search handle is closed. Other operating systems may not require any
*		action.
**/
void findEnd( void *pvOsArg )
{
#ifdef WIN32
	FindClose( *((HANDLE *)pvOsArg) );
#else
	#error Function findEnd() not implemented
#endif /* WIN32 */
}
