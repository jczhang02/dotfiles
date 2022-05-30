/* Generated automatically */
static HashNode getparamnode _((HashTable ht,const char*nam));
static void scancopyparams _((HashNode hn,UNUSED(int flags)));
static void scanparamvals _((HashNode hn,int flags));
static char**getvaluearr _((Value v));
static void shempty _((void));
static zlong getarg _((char**str,int*inv,Value v,int a2,zlong*w,int*prevcharlen,int*nextcharlen,int flags));
static void check_warn_pm _((Param pm,const char*pmtype,int created,int may_warn_about_nested_vars));
static void intsetfn _((Param pm,zlong x));
static double floatgetfn _((Param pm));
static void floatsetfn _((Param pm,double x));
static void arrhashsetfn _((Param pm,char**val,int flags));
static void simple_arrayuniq _((char**x,int freeok));
static void arrayuniq_freenode _((HashNode hn));
static void arrayuniq _((char**x,int freeok));
static void setlang _((char*x));
static void argzerosetfn _((UNUSED(Param pm),char*x));
static char*argzerogetfn _((UNUSED(Param pm)));
static char**pipestatgetfn _((UNUSED(Param pm)));
static void pipestatsetfn _((UNUSED(Param pm),char**x));
#ifndef USE_SET_UNSET_ENV
static int findenv _((char*name,int*pos));
#endif
static void copyenvstr _((char*s,char*value,int flags));
static char*mkenvstr _((char*name,char*value,int flags));
static void scanendscope _((HashNode hn,UNUSED(int flags)));
