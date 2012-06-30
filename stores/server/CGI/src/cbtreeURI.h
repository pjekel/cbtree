#ifndef __CBTREE_URI_H__
#define __CBTREE_URI_H__

#include "cbtreeCommon.h"

#ifdef __cplusplus
	extern "C" {
#endif

char *decodeURI( char *pSrc, char *pDst, size_t iDstLen );
char *encodeReserved( const char *pcSrc, char *pcDst, size_t iDstLen );
char *pathToUnix( char *pcPath );
char *normalizePath( char *pcPath );

#ifdef __cplusplus
	}
#endif

#endif /* __CBTREE_URI_H__ */
