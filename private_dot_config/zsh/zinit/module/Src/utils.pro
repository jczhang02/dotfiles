/* Generated automatically */
#ifdef MULTIBYTE_SUPPORT
#endif /* MULTIBYTE_SUPPORT */
static char**slashsplit _((char*s));
static int xsymlinks _((char*s,int full));
static void finddir_scan _((HashNode hn,UNUSED(int flags)));
static int dircmp _((char*s,char*t));
static void checkmailpath _((char**s));
static void spscan _((HashNode hn,UNUSED(int scanflags)));
static int skipwsep _((char**s));
static int findsep _((char**s,char*sep,int quote));
#ifdef MULTIBYTE_SUPPORT
#endif
#ifdef MULTIBYTE_SUPPORT
#endif /* MULTIBYTE_SUPPORT */
static char*spname _((char*oldname));
static int mindist _((char*dir,char*mindistguess,char*mindistbest,int wantdir));
static int spdist _((char*s,char*t,int thresh));
#ifdef MULTIBYTE_SUPPORT
#else
#endif /* MULTIBYTE_SUPPORT */
static int upchdir _((int n));
