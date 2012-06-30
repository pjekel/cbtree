#ifndef _CBTREE_ARGS_H_
#define _CBTREE_ARGS_H_

#include "cbtreeTypes.h"
#include "cbtreeList.h"
#include "pcre.h"					// http://www.pcre.org

// Query parameter
typedef struct query {
	char		*pcProperty;		// Query property (property of a file).
	int			iPropertyId;		// File property identification.
	int			iDataType;			// Query parameter data type.
	pcre		*pPCRE;				// Pointer to a pre-compiled regular expression.
	union {
		bool	bBoolean;
		int		iInteger;
	} value;
} QUERY;

typedef struct options {
	bool	bDeep;					// Indicate if a recursive search is to be performed.
	bool	bLoadAll;				// Same as bDeep but has a different meaning on the client side.
	bool	bIgnoreCase;			// Match filename and path case insensitive.
	bool	bShowHiddenFiles;		// Indicate if hidden files are to be included.
	bool	bDirsOnly;				// Indicate if only directories are to be included.
	bool	bDebug;					// Indicate if debug information need to be generated.
} OPTIONS;

// Sort parameter
typedef struct sort {
	char		*pcProperty;		// Property name.
	bool		bDescending;		// sort order.
	bool		bIgnoreCase;		// compare strings case insensitive.
	int			iPropertyId;		// File property identification.
} SORT;

typedef struct arguments {
	const char	*pcBasePath;		// Pointer to a C-string containing the base path
	const char	*pcPath;			// Pointer to a C-string containing the path
	int			iCount;				// File count requested
	int			iStart;				// Offset first file found.
	OPTIONS		*pOptions;			// Pointer to the query options struct
	LIST		*pQueryList;		// Address query arguments list
	LIST		*pSortList;			// Address Sort specifications list
} ARGS;

#ifdef __cplusplus
	extern "C" {
#endif

void  destroyArguments( ARGS **ppArgs );
ARGS *getArguments( int *piResult );

#ifdef __cplusplus
	}
#endif

#endif /* _CBTREE_ARGS_H_ */
