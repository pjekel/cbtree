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
*		Some debug support routines provided for conveniance only.
*
****************************************************************************************/
#ifdef _MSC_VER
	#define _CRT_SECURE_NO_WARNINGS
#endif	/* _MSC_VER */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#include "cbtreeCommon.h"
#include "cbtreeDebug.h"

FILE	*phDbgFile = NULL;

/**
*	_timeStamp
*
*		Returns an Apache style log timestamp.
**/
static char *_timeStamp()
{
	static char	cTimeBuf[128];
	struct tm	*timeInfo;
	time_t		sysTime;

	time( &sysTime );
	timeInfo = localtime( &sysTime );

	strftime( cTimeBuf, sizeof(cTimeBuf), "[%d/%b/%Y:%X]", timeInfo );
	return cTimeBuf;
}

/**
*	cbtDebug
*
*		Write a message to the log file.
*
*	@param	pcFormat		Address C-string containing the message format string.
*	@param	...				Variable list of arguments.
**/
void cbtDebug( const char *pcFormat, ... )
{
	char	cBuffer[MAX_BUF_SIZE];
	va_list	ArgPtr;

	va_start (ArgPtr, pcFormat );
	if( !phDbgFile )
	{
		if( !(phDbgFile = fopen( "cbtreeCGI.log", "w+" )) )
		{
			va_end( ArgPtr );
			return;
		}
	}
	vsnprintf( cBuffer, sizeof(cBuffer)-1, pcFormat, ArgPtr );
	fprintf( phDbgFile, "%s %s", _timeStamp(), cBuffer );
	fflush( phDbgFile );
	
	va_end( ArgPtr );
}

/**
*	cbtDebugEnd
*
*		Close the log file.
**/
void cbtDebugEnd()
{
	if( phDbgFile )
	{
		fclose( phDbgFile );
		phDbgFile = NULL;
	}
}