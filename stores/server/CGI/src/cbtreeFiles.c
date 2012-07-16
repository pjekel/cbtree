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
*		This module provides all the functionality to search file paths, match
*		files agains a set of query arguments and sort file lists on the fly.
*
*	NOTE:	In contrast to the PHP implementation, the CGI implementation sorts
*			any file list on the fly. Therefore the are no calls to functions
*			like the PHP usort()
*
****************************************************************************************/
#ifdef _MSC_VER
	#define _CRT_SECURE_NO_WARNINGS
#endif	/* _MSC_VER */

#include <stdio.h>
#include <stdlib.h>
#include <limits.h>
#include <direct.h>
#include <errno.h>
#include <io.h>

#include "cbtree_NP.h"
#include "cbtreeDebug.h"
#include "cbtreeFiles.h"
#include "cbtreeURI.h"
#include "cbtreeString.h"

#define compareStr(a,b,c) ((c) ? stricmp((a),(b)) : strcmp((a),(b)))
#define compareInt(a,b) ((a) == (b) ? 0 : ( (a)<(b) ? -1 : 1))

typedef struct fileList {
	FILE_INFO	*pFirst;	// First file list entry
	FILE_INFO	*pLast;		// Last file list entry
} FILE_LIST;

static const char *pcFileProp[] = { "name", "path", "directory", "size", "modified", NULL };

static int _fileCompare( FILE_INFO *pFileA, FILE_INFO *pFileB, LIST *pSortList );
static int _removeFile( LIST *pFileList, FILE_INFO *pFileInfo, char *pcRootDir, ARGS *pArgs, int *piResult );

/**
*	_destroyFileInfo
*
*		Release all resources associated with a FILE_INFO struct. If the file has
*		child elements linked to it all of them are release as well.
*
*	@param	pFileInfo		Address FILE_INFO struct.
**/
static void _destroyFileInfo( FILE_INFO *pFileInfo )
{
	if( pFileInfo )
	{
		free( pFileInfo->pcPath );
		free( pFileInfo->pcName );
		free( pFileInfo->pcIconClass );

		if( pFileInfo->pChildren )
		{
			destroyList( &pFileInfo->pChildren, _destroyFileInfo );
		}
		free( pFileInfo );
	}
}

/**
*	_fileAddToList
*
*		Add a file (FILE_INFO) to a list. If any sort parameters are specified the
*		file is inserted according to those sort specification otherwise the file
*		is added at the end of the list.
*
*	@param	pFileInfo		Address FILE_INFO struct.
*	@param	pFileLits		Address LIST header.
*	@param	pArgs			Address query string arguments struct
**/
static void _fileAddToList( FILE_INFO *pFileInfo, LIST *pFileList, ARGS *pArgs )
{
	ENTRY	*pEntry;
	int		iResult = 0;
	
	if( pArgs->pSortList )
	{
		for( pEntry = pFileList->pNext; pEntry != pFileList; pEntry = pEntry->pNext )
		{
			iResult = _fileCompare( (FILE_INFO *)pEntry->pvData, pFileInfo, pArgs->pSortList );
			if( iResult <= 0 )
			{
				break;
			}
		}
		if( pEntry != pFileList )
		{
			insertList( pFileInfo, pEntry, iResult );
			return;
		}
	}
	insertTail( pFileInfo, pFileList );
}

/**
*	_fileCompare
*
*		Returns the comparison result of an attribute of two files based on a set of
*		sort specification. The result returned is either:
*
*			-1	- Attribute of file A is less than file B
*			 0	- Attributes of file A and B are identical
*			 1	- Attribute of file A is greater than file B
*
*		All sort specification are executed until one of them returns a value other
*		than zero or there are no more sort specification available.
*
*	@param	pFileA			Address FILE_INFO struct identifying file A
*	@param	pFileB			Address FILE_INFO struct identifying file B
*	@param	pSortSpec		Address SORT struct
*
*	@return		Integer value either -1, 0, 1
**/
static int _fileCompare( FILE_INFO *pFileA, FILE_INFO *pFileB, LIST *pSortList )
{
	ENTRY	*pEntry;
	SORT	*pSort;
	int		iResult = 0;
	
	for( pEntry = pSortList->pNext; pEntry != pSortList; pEntry = pEntry->pNext )
	{
		pSort = (SORT *)pEntry->pvData;
		switch( pSort->iPropertyId )
		{
			case 0:	// name
				iResult = compareStr( pFileB->pcName, pFileA->pcName, pSort->bIgnoreCase );
				break;
			case 1: // path
				iResult = compareStr( pFileB->pcPath, pFileA->pcPath, pSort->bIgnoreCase );
				break;
			case 2: // directory
				iResult = compareInt( pFileB->directory, pFileA->directory );
				break;
			case 3: // size
				iResult = compareInt( pFileB->lSize, pFileA->lSize );
				break;
			case 4: // modified
				iResult = compareInt( pFileB->lModified, pFileA->lModified );
				break;
		}
		iResult = pSort->bDescending ? (iResult * -1): iResult;
		if( iResult ) break;
	}
	return (iResult ? (iResult > 0 ? 1: -1) : 0);
}

/**
*	_fileExecRegExp
*
*		Parse the string identified by parameter pcString using a pre-compiled
*		regular expression.
*
*	@param	pRegEx			Address pre-compile Perl Compatible Regular Expression.
*	@param	pcString		Address C-string containing the string to match.
*
*	@return		True if there is a match otherwise false.
**/
static bool _fileExecRegExp( pcre *pRegEx, char *pcString )
{
	int		iOffsetVect[9],
			iMatch;
	
	iMatch = pcre_exec( pRegEx, NULL, pcString, strlen(pcString), 0,0, iOffsetVect, 9);
	return (iMatch > 0) ? true : false;
}

/**
*	_fileFilter
*
*		Returns true if a file is to be exlcuded (filtered) based on the HTTP query
*		string parameters, otherwise false.
*
*	@param	pFileInfo		Address FILE_INFO struct.
*	@param	pArgs			Address query string arguments struct
* 
*	@return	true or false
**/
static bool _fileFilter( FILE_INFO *pFileInfo, ARGS *pArgs )
{
	OPTIONS	*pOptions = pArgs->pOptions;

	if( (!pOptions->bShowHiddenFiles && (pFileInfo->pcName[0] == '.' || pFileInfo->bIsHidden)) ||
		(pOptions->bDirsOnly && !pFileInfo->directory) ||
		(!strcmp(pFileInfo->pcName, ".") || !strcmp(pFileInfo->pcName, "..")) )
	{
		return true;
	}
	return false;
}

/**
*	_fileMatchQuery
*
*		Returns true if a file matches all query arguments otherwise false.
*
*	@param	pFileInfo		Address FILE_INFO struct.
*	@param	pQueryList		Address query arguments list
*
*	@return		True is the file matches ALL query arguments otherwise false.
**/
static bool _fileMatchQuery( FILE_INFO *pFileInfo, LIST *pQueryList )
{
	ENTRY	*pEntry;
	QUERY	*pQuery;
	int		iResult = 0;
	
	for( pEntry = pQueryList->pNext; pEntry != pQueryList; pEntry = pEntry->pNext )
	{
		pQuery = pEntry->pvData;
		switch( pQuery->iDataType )
		{
			case TYPE_V_STRING:
				switch(pQuery->iPropertyId)
				{
					case PROP_V_NAME:
						iResult = _fileExecRegExp( pQuery->pPCRE, pFileInfo->pcName );
						break;
					case PROP_V_PATH:
						iResult = _fileExecRegExp( pQuery->pPCRE, pFileInfo->pcPath );
						break;
				}
				break;
			case TYPE_V_BOOLEAN:
				switch(pQuery->iPropertyId)
				{
					case PROP_V_DIRECTORY:
						iResult = (pQuery->value.bBoolean == pFileInfo->directory);
						break;
				}
				break;
			case TYPE_V_INTEGER:
				switch(pQuery->iPropertyId)
				{
					case PROP_V_MODIFIED:
						iResult = (pQuery->value.iInteger == pFileInfo->lModified);
						break;
					case PROP_V_SIZE:
						iResult = (pQuery->value.iInteger == pFileInfo->lSize);
						break;
				}
				break;
			case TYPE_V_NULL:
				switch(pQuery->iPropertyId)
				{
					case PROP_V_DIRECTORY:
						iResult = (int)!pFileInfo->directory;
						break;
					case PROP_V_NAME:
					case PROP_V_PATH:
					case PROP_V_SIZE:
					case PROP_V_MODIFIED:
					default:
						iResult = 0;
						break;
				}
				break;					
		}
		if( !iResult )
		{
			return false;
		}
	}
	return iResult ? true : false;
}

/**
*	_removeDirectory
*
*		Delete a directory. The content of the directory is deleted after which
*		the directory itself is delete.
*
*	@param	pFileList		Address LIST struct containing all deleted files.
*	@param	pcFullPath		Address C-string containing the full directory path.
*	@param	pcRootDir		Address C-string containing the root directory.
*	@param	pArgs			Address arguments struct
*	@param	piResult		Address integer receiving the final result code:
*							HTTP_V_OK, HTTP_V_NOT_FOUND, HTTP_V_UNAUTHORIZED or
*							HTTP_V_SERVER_ERROR
*
*	@return		1 if successful otherwise 0.
**/
static int _removeDirectory( LIST *pFileList, char *pcFullPath, char *pcRootDir, ARGS *pArgs, int *piResult )
{
	FILE_INFO	*pDirectory;
	LIST	*pDirList, 
			*pChildList;
	ENTRY	*pEntry;
	int		iResult,
			iMode = 0777;
	
	if( (pDirList = getFile( pcFullPath, pcRootDir, pArgs, piResult )) )
	{
		pDirectory = pDirList->pNext->pvData;
		pChildList = pDirectory->pChildren;

		chmod( pcFullPath, iMode );
		// Delete directory content		
		for( pEntry = pChildList->pNext; pEntry != pChildList; pEntry = pEntry->pNext )
		{
			iResult = _removeFile( pFileList, pEntry->pvData, pcRootDir, pArgs, piResult );
			if( iResult )
			{
				// Detach child from list so it won't be destroyed.
				pEntry->pvData = NULL;
			}
		}
		destroyFileList( &pDirList );

		*piResult = HTTP_V_OK;
		// Now delete the directory itself.
		return rmdir( pcFullPath );
	}
	return ENOENT;
}

/**
*	removeFile
*
*		Delete a file or directory. If the file is a directory the directory and
*		its content is deleted. Deleted files are added to the list of deleted
*		files 'pFileList'.
*
*	@param	pFileList		Address LIST struct containing all deleted files.
*	@param	pcFullPath		Address C-string containing the full directory path.
*	@param	pcRootDir		Address C-string containing the root directory.
*	@param	pArgs			Address arguments struct
*	@param	piResult		Address integer receiving the final result code:
*							HTTP_V_OK, HTTP_V_NOT_FOUND, HTTP_V_UNAUTHORIZED or
*							HTTP_V_SERVER_ERROR
*
*	@return		1 if successful otherwise 0.
**/
static int _removeFile( LIST *pFileList, FILE_INFO *pFileInfo, char *pcRootDir, ARGS *pArgs, int *piResult )
{
	char	cFilePath[MAX_PATH_SIZE];
	int		iResult,
			iMode = 0666;

	if( pFileInfo )
	{
		*piResult = HTTP_V_OK;
		snprintf( cFilePath, sizeof(cFilePath)-1, "%s%s", pcRootDir, pFileInfo->pcPath );
		if( pFileInfo->directory )
		{
			iResult = _removeDirectory( pFileList, cFilePath, pcRootDir, pArgs, piResult );
		}
		else
		{
			chmod( cFilePath, iMode );
			iResult = remove( cFilePath );
		}
		// If success, add to the list of deleted files.
		if( iResult == 0 ) 
		{
			insertTail( pFileInfo, pFileList );
		}
		else
		{
			switch( errno )
			{
				case ENOTEMPTY:	// Directory not empty
				case EACCES:	// Access denied
				case EPERM:		// No permission
				case EBUSY:		// System file
				case EROFS:		// Read-only File System
					*piResult = HTTP_V_UNAUTHORIZED;
					break;				
				case ENOENT:
					*piResult = HTTP_V_NOT_FOUND;
					break;
				default:
					*piResult = HTTP_V_SERVER_ERROR;
					break;
			}
			cbtDebug( "DELETE [%s] errno: %d", cFilePath, errno );
		}
		return (iResult ? 0 : 1);
	}
	*piResult = HTTP_V_NO_CONTENT;
	return 0;
}

/**
*	destroyFileList
*
*		Release all resources associated with a file list. Not only is the list deleted
*		but also ALL FILIE_INFO structs the list referencing.
*
*	@param	ppFileList		Address of a pointer of type LIST.
**/
void destroyFileList( LIST **ppFileList )
{
	destroyList( ppFileList, _destroyFileInfo );
}

/**
*	fileCount
*
*		Returns the number of files in a linked list. If parameter iDeep equals true a
*		recursive count is performed, that is, all children in directories are included
*		in the total count. By default only siblings of pFileInfo are counted.
*
*	@param	pFileInfo		Address FILE_INFO struct.
*	@param	iDeep			Boolean, if true a recursive count is performed counting
*							all files and their children, if any.
*
*	@return		The number of files counted.
**/
int fileCount( LIST *pFileList, bool iDeep )
{
	FILE_INFO	*pFileInfo;
	ENTRY		*pEntry;
	int			iCount = 0;

	for( pEntry = pFileList->pNext; pEntry != pFileList; pEntry = pEntry->pNext )
	{
		pFileInfo = (FILE_INFO *)pEntry->pvData;
		
		if( pFileInfo->pChildren && iDeep)
		{
			iCount += fileCount( pFileInfo->pChildren, iDeep );
		}
		iCount++;
	}
	return iCount;
}

/**
*	fileSlice
*
*		Returns a new list of files based on the parameters iStart and iCount.
*		Parameter iStart signifies the starting point in the existing file list
*		whereas iCount specifies the maximum number of entries to be returned.
*
*	@note	The list returned references the same FILE_INFO structs as the original
*			pFileList. Therefore, destoying one list will effect the other. 
*			To destroy the slice list without destoying the referenced FILE_INFO
*			call destroyList( sliceList, NULL ) instead of destroyFileList().
*
*	@param	pFileInfo		Address FILE_INFO struct.
*	@param	iStart			Offset of the starting entry in the file list.
*	@param	iCount			Number of files to be returned.   If iCount equals 0 all files
*							in the list are returned. If iCount is greater than the number
*							of files available, all available files are returned. If iCount
*							is a negative value, the total number of files minus iCount is
*							returned.
*
*	@return		Address FILE_INFO struct or NULL.
**/
LIST *fileSlice( LIST *pFileList, int iStart, int iCount )
{
	LIST	*pSlice = newList();
	ENTRY	*pEntry;
	
	int		iOffset = (iStart > 0 ? iStart : 0),
			iMax	= iCount ? iCount : INT_MAX;

	if( pFileList )
	{
		if( iMax < 0 )
		{
			iMax = fileCount( pFileList, false ) + iMax;
			if( iMax < 0 )
			{
				return pSlice;
			} 
		}
		// Find the list offset first and then start counting.
		for( pEntry = pFileList->pNext; pEntry != pFileList && iOffset; pEntry = pEntry->pNext, iOffset-- ); 
		for( ; pEntry != pFileList && iMax; pEntry = pEntry->pNext, iMax-- )
		{
			insertTail( pEntry->pvData, pSlice );
		}
	}
	return pSlice;
}

/**
*	getDirectory
*
*		Returns the content of a directory as a linked list of FILE_INFO structs.
*
*	@param	pcFullPath		Address C-string containing the full directory path.
*	@param	pcRootDir		Address C-string containing the root directory.
*	@param	pArgs			Address arguments struct
*	@param	piResult		Address integer receiving the final result code:
*							HTTP_V_OK, HTTP_V_NOT_FOUND or HTTP_V_NO_CONTENT
*
*	@return		Address LIST struct or NULL in case no match was found.
**/
LIST *getDirectory( char *pcFullPath, char *pcRootDir, ARGS *pArgs, int *piResult )
{
	FILE_INFO	*pFileInfo;
	OPTIONS		*pOptions = pArgs->pOptions;
	OS_ARG		OSArg;
	LIST		*pFileList = NULL;
	char		cFullPath[MAX_PATH_SIZE];
	int			iResult;
	
	if( (pFileInfo = findFile_NP( pcFullPath, pcRootDir, &OSArg, pArgs, piResult )) )
	{
		pFileList = newList();		// Allocate a new list header.
		do {
			if( !_fileFilter( pFileInfo, pArgs ) )
			{
				if( pFileInfo->directory && pOptions->bDeep )
				{
					snprintf( cFullPath, sizeof(cFullPath)-1, "%s%s/*", pcRootDir, pFileInfo->pcPath );
					pFileInfo->pChildren  = getDirectory( cFullPath, pcRootDir, pArgs, &iResult );
					pFileInfo->bIsExpanded = true;
				}
				_fileAddToList( pFileInfo, pFileList, pArgs );
				*piResult = HTTP_V_OK;
			}
			else // File was filtered out
			{
				_destroyFileInfo( pFileInfo );
			}
		} while ( (pFileInfo = findNextFile_NP( pcFullPath, pcRootDir, &OSArg, pArgs )) );

		if( listIsEmpty( pFileList ) )
		{
			*piResult = HTTP_V_NO_CONTENT;
		}
		findEnd_NP( &OSArg );		
	}
	return pFileList;
}

/**
*	getFile
*
*		Returns the information for the file specified by parameter pcFullPath.
*		If the designated file is a directory the directory content is returned
*		as the children of the file.
*
*	@note	If the full path contains wildcards only the first match is returned.
*
*	@param	pcFullPath		Address C-string containing the full directory path.
*	@param	pcRootDir		Address C-string containing the root directory.
*	@param	pArgs			Address arguments struct
*	@param	piResult		Address integer receiving the final result code:
*							HTTP_V_OK, HTTP_V_NOT_FOUND or HTTP_V_NO_CONTENT
*
*	@return		Address LIST struct or NULL in case no match was found.
**/
LIST *getFile( char *pcFullPath, char *pcRootDir, ARGS *pArgs, int *piResult )
{
	FILE_INFO	*pFileInfo;
	OS_ARG		OSArg;
	LIST		*pFileList = NULL;
	char		cFullPath[MAX_PATH_SIZE];
	int			iResult;
	
	if( (pFileInfo = findFile_NP( pcFullPath, pcRootDir, &OSArg, pArgs, piResult )) )
	{
		if( !_fileFilter( pFileInfo, pArgs ) )
		{
			pFileList = newList();
			if( pFileInfo->directory )
			{
				snprintf( cFullPath, sizeof(cFullPath)-1, "%s%s/*", pcRootDir, pFileInfo->pcPath );
				pFileInfo->pChildren   = getDirectory( cFullPath, pcRootDir, pArgs, &iResult );
				pFileInfo->bIsExpanded = true;
			}
			insertTail( pFileInfo, pFileList );
			*piResult = HTTP_V_OK;
		}
		else // File was excluded
		{
			_destroyFileInfo( pFileInfo );
			*piResult = HTTP_V_NO_CONTENT;
		}
		findEnd_NP( &OSArg );		
	}
	return pFileList;
}

/**
*	getPropertyId
*
*		Return the identification (index) of a file property.
*
*	@param	pcProperty			Address C-string containing the property name.
*
*	@return		Integer property id.
**/
int getPropertyId( const char *pcProperty )
{
	int	i;

	for( i=0; pcFileProp[i]; i++ )
	{
		if( !strcmp( pcProperty, pcFileProp[i] ) )
		{
			return i;
		}
	}
	return PROP_V_UNKNOWN;
}

/**
*	getRelativePath
*
*		Returns the relative path for the file identified by pcFilename. The relative
*		path is constructed by removing the leading root directory segments and the
*		last segment from the full path after which the filename is appended. Given
*		the following example:
*
*			Full path = "c:/myroot_dir/html/demos/*"
*			Root dir  = "c:/myroot_dir/"
*			Filename  = "license.txt"	
*
*		The relative path will be: "html/demos/license.txt"
*
*	@note	The relative path format is referred to as a 'noschema path'
*
*	@param	pcFullPath		Address C-string containing the full directory path.
*	@param	pcRootDir		Address C-string containing the root directory.
*	@param	pcFilename		Address C-string containing the filename
*	@param	ppcPath			Address of a char pointer pointing to the location at
*							which the relative path will be stored.
*
*	@return		Address C-string containing the relative path (*ppcPath).
**/
char *getRelativePath( char *pcFullPath, char *pcRootDir, char *pcFilename, char **ppcPath )
{
	char	cPath[MAX_PATH_SIZE];
	char	*pcRelPath,
			*pcPath = cPath;
	int		iLen;

	if( pcFullPath )
	{
		iLen = strlen( pcRootDir );
		pcRelPath = &pcFullPath[iLen];
		
		while( (*pcPath++ = *pcRelPath++) );
		while( --pcPath != cPath ) 
		{
			if( *pcPath == '/' )  
			{
				pcPath++;
				break;
			}
		}
		*pcPath   = '\0';
	}	
	while( (*pcPath++ = *pcFilename++) );
	return strcpy( *ppcPath, cPath );
}

/**
*	getMatch
*
*		Returns a list of FILE_INFO structs that match ALL query arguments. Whenever
*		a deep (recursive) search is requested all sub-directories are searched and
*		any matching children are merged with the top-level matches. Therefore, the
*		list returned does NOT have a tree structure, instead it is a flat file list.
*
*	@param	pcFullPath		Address C-string containing the full directory path.
*	@param	pcRootDir		Address C-string containing the root directory.
*	@param	pArgs			Address arguments struct
*	@param	piResult		Address integer receiving the final result code:
*							HTTP_V_OK, HTTP_V_NOT_FOUND or HTTP_V_NO_CONTENT
*
*	@return		Address LIST struct or NULL in case no match was found.
**/
LIST *getMatch( char *pcFullPath, char *pcRootDir, ARGS *pArgs, int *piResult )
{
	FILE_INFO	*pFileInfo;
	LIST		*pSortList = pArgs->pSortList,
				*pFileList = NULL,
				*pChildList;
	ENTRY		*pEntry;
	OS_ARG		OSArg;
	char		cFullPath[MAX_PATH_SIZE];
	int			iResult;

	if( (pFileInfo = findFile_NP( pcFullPath, pcRootDir, &OSArg, pArgs, piResult )) )
	{
		pFileList = newList();	// Allocate a new list header
		do {
			if( !_fileFilter( pFileInfo, pArgs ) )
			{
				if( _fileMatchQuery( pFileInfo, pArgs->pQueryList ) )
				{
					_fileAddToList( pFileInfo, pFileList, pArgs );
					*piResult = HTTP_V_OK;
				}
				if( pFileInfo->directory && pArgs->pOptions->bDeep )
				{
					snprintf( cFullPath, sizeof(cFullPath)-1, "%s%s/*", pcRootDir, pFileInfo->pcPath );
					pArgs->pSortList = NULL;	// Don't sort sub-directories matches yet.
					pChildList = getMatch( cFullPath, pcRootDir, pArgs, &iResult );
					if( pChildList )
					{
						if( pSortList )
						{
							pArgs->pSortList = pSortList;	// Restore sort setting.
							for( pEntry = pChildList->pNext; pEntry != pChildList; pEntry = pEntry->pNext )
							{
								_fileAddToList( pEntry->pvData, pFileList, pArgs );
							}
						}
						else // No sort required.
						{
							mergeList( pFileList, pChildList );
						}
						destroyList( &pChildList, NULL );
						*piResult = HTTP_V_OK;
					}
					pArgs->pSortList = pSortList;	// Restore sort setting.
				}
			}
			else // File was filtered out.
			{
				_destroyFileInfo( pFileInfo );
			}
		} while ( (pFileInfo = findNextFile_NP( pcFullPath, pcRootDir, &OSArg, pArgs )) );

		if( listIsEmpty( pFileList ) )
		{
			*piResult = HTTP_V_NO_CONTENT;
		}
		findEnd_NP( &OSArg );		
	}
	return pFileList;
}

/**
*	removeFile
*
*		Delete a file or directory. If the file is a directory the content of the
*		directory is deleted resurcive.
*
*	@param	pcFullPath		Address C-string containing the full directory path.
*	@param	pcRootDir		Address C-string containing the root directory.
*	@param	pArgs			Address arguments struct
*	@param	piResult		Address integer receiving the final result code:
*							HTTP_V_OK, HTTP_V_NOT_FOUND, HTTP_V_UNAUTHORIZED or
*							HTTP_V_SERVER_ERROR
*
*	@return		Address LIST struct containing all files deleted.
**/
LIST *removeFile( FILE_INFO *pFileInfo, char *pcRootDir, ARGS *pArgs, int *piResult )
{
	LIST	*pFileList = newList();

	*piResult = HTTP_V_NO_CONTENT;

	// Set the appropriate options so we catch hidden files and don't include more
	// info than we need in the output.
	pArgs->pOptions->bShowHiddenFiles = true;
	pArgs->pOptions->bIconClass		  = false;
	pArgs->pOptions->bDeep			  = false;

	if( pFileInfo )
	{
		_removeFile( pFileList, pFileInfo, pcRootDir, pArgs, piResult );
	}
	return pFileList;
}

/**
*	renameFile
*
*		Rename a file
*
*	@param	pcFullPath		Address C-string containing the full directory path.
*	@param	pcRootDir		Address C-string containing the root directory.
*	@param	pArgs			Address arguments struct
*	@param	piResult		Address integer receiving the final result code:
*							HTTP_V_OK, HTTP_V_NOT_FOUND or HTTP_V_NO_CONTENT
*
*	@return		Address LIST struct or NULL in case no match was found.
**/
LIST *renameFile( char *pcFullPath, char *pcRootDir, ARGS *pArgs, int *piResult )
{
	FILE_INFO	*pFileInfo;
	LIST		*pFileList = NULL;
	OS_ARG		OSArg;
	char		cFilename[MAX_PATH_SIZE],
				cNewPath[MAX_PATH_SIZE],
				cPath[MAX_PATH_SIZE];
	char		*pcFilename = cFilename,
				*pcPath = cPath;
		
	if( (pFileInfo = findFile_NP( pcFullPath, pcRootDir, &OSArg, pArgs, piResult )) )
	{
		parsePath( pcFullPath, sizeof(cPath)-1, &pcPath, sizeof(cFilename)-1, &pcFilename );
		_destroyFileInfo( pFileInfo );

		switch( getPropertyId( pArgs->pcAttribute ) )
		{
			case PROP_V_NAME:	// name
				snprintf( cNewPath, sizeof(cNewPath)-1, "%s/%s", cPath, pArgs->pcNewValue );
				break;
			case PROP_V_PATH: // path
				snprintf( cNewPath, sizeof(cNewPath)-1, "%s/%s", pcRootDir, pArgs->pcNewValue );
				break;
			default:
				*piResult = HTTP_V_BAD_REQUEST;
				return NULL;
		}
		strtrim( normalizePath( cNewPath ), TRIM_M_WSP );
		if( !strncmp( pcRootDir, cNewPath, strlen(pcRootDir)) )
		{
			if(rename(pcFullPath, cNewPath))
			{
				switch( errno )
				{
					case ENOTEMPTY:	// Directory not empty
					case EACCES:	// Access denied
					case EPERM:		// No permission
					case EBUSY:		// System file
					case EROFS:		// Read-only File System
					case EXDEV:		// Two different file systems.
						*piResult = HTTP_V_UNAUTHORIZED;
						break;
					case EEXIST:	
						*piResult = HTTP_V_CONFLICT;
						break;
					case ENOENT:
						*piResult = HTTP_V_NOT_FOUND;
						break;
					default:
						*piResult = HTTP_V_SERVER_ERROR;
						break;
				}
				cbtDebug( "POST Oldname: [%s], newname: [%s], (error: %d, %s )", 
						  pcFullPath, cNewPath, errno, strerror(errno) );
			}
			else
			{
				pFileList = getFile( cNewPath, pcRootDir, pArgs, piResult );
			}
		}
		else
		{
			*piResult = HTTP_V_FORBIDDEN;
		}
	}
	return pFileList;
}
