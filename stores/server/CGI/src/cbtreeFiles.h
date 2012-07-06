#ifndef _CBTREE_FILES_H_
#define _CBTREE_FILES_H_

#include "cbtreeArgs.h"
#include "cbtreeList.h"

// Define symbolic file properties
#define PROP_V_UNKNOWN		-1
#define PROP_V_NAME			0
#define PROP_V_PATH			1
#define PROP_V_DIRECTORY	2
#define PROP_V_SIZE			3
#define PROP_V_MODIFIED		4

typedef struct fileInfo {
	char	*pcName;			// Pointer to C-string containing the filename
	char	*pcPath;			// Pointer to C-string containing the file path
	char	*pcIconClass;		// Pointer to C-string containinf the iconClass;
	long	lSize;				// File size
	long	lModified;			// Last modified (seconds since Jan 1, 1970)
	bool	directory;			// True if file is a directory
	bool	bIsHidden;			// True if file is marked as hidden.
	bool	bIsExpanded;		// True if pChildren holds the list of children.
	LIST	*pChildren;			// List of children (directory only).
} FILE_INFO;

#ifdef __cplusplus
	extern "C" {
#endif

void fileDump( LIST *pFileList );

void  destroyFileList( LIST **ppList );
int	  fileCount( LIST *pFileList, bool iDeep );
LIST *fileSlice( LIST *pFileList, int iStart, int iCount );
int   getPropertyId( const char *pcProperty );
LIST *getDirectory( char *pcFullPath, char *pcRootDir, ARGS *pArgs, int *piResult );
LIST *getFile( char *pcFullPath, char *pcRootDir, ARGS *pArgs, int *piResult );
char *getRelativePath( char *pcFullPath, char *pcRootDir, char *pcFilename, char **ppcPath );
LIST *getMatch( char *pcFullPath, char *pcRootDir, ARGS *pArgs, int *piResult );

#ifdef __cplusplus
	}
#endif

#endif	/* _CBTREE_FILES_H_ */
