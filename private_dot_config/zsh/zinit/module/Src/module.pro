/* Generated automatically */
static int addbuiltin _((Builtin b));
static int add_autobin _((const char*module,const char*bnam,int flags));
static int del_autobin _((UNUSED(const char*module),const char*bnam,int flags));
static int setbuiltins _((char const*nam,Builtin binl,int size,int*e));
static int addconddef _((Conddef c));
static int setconddefs _((char const*nam,Conddef c,int size,int*e));
static int add_autocond _((const char*module,const char*cnam,int flags));
static int del_autocond _((UNUSED(const char*modnam),const char*cnam,int flags));
static int setparamdefs _((char const*nam,Paramdef d,int size,int*e));
static int add_autoparam _((const char*module,const char*pnam,int flags));
static int del_autoparam _((UNUSED(const char*modnam),const char*pnam,int flags));
static int addmathfunc _((MathFunc f));
static int setmathfuncs _((char const*nam,MathFunc f,int size,int*e));
static int add_automathfunc _((const char*module,const char*fnam,int flags));
static int del_automathfunc _((UNUSED(const char*modnam),const char*fnam,int flags));
#ifdef DYNAMIC
#ifdef AIXDYNAMIC
#else
#ifdef HPUX10DYNAMIC
#endif
#endif /* !AIXDYNAMIC */
static void*try_load_module _((char const*name));
static void*do_load_module _((char const*name,int silent));
#else /* !DYNAMIC */
static void*do_load_module _((char const*name,int silent));
#endif /* !DYNAMIC */
static Module find_module _((const char*name,int flags,const char**namep));
static void delete_module _((Module m));
#ifdef DYNAMIC
#ifdef AIXDYNAMIC
static int dyn_setup_module _((Module m));
static int dyn_features_module _((Module m,char***features));
static int dyn_enables_module _((Module m,int**enables));
static int dyn_boot_module _((Module m));
static int dyn_cleanup_module _((Module m));
static int dyn_finish_module _((Module m));
#else
static int dyn_setup_module _((Module m));
static int dyn_features_module _((Module m,char***features));
static int dyn_enables_module _((Module m,int**enables));
static int dyn_boot_module _((Module m));
static int dyn_cleanup_module _((Module m));
static int dyn_finish_module _((Module m));
#endif /* !AIXDYNAMIC */
static int setup_module _((Module m));
static int features_module _((Module m,char***features));
static int enables_module _((Module m,int**enables));
static int boot_module _((Module m));
static int cleanup_module _((Module m));
static int finish_module _((Module m));
#else /* !DYNAMIC */
static int setup_module _((Module m));
static int features_module _((Module m,char***features));
static int enables_module _((Module m,int**enables));
static int boot_module _((Module m));
static int cleanup_module _((Module m));
static int finish_module _((Module m));
#endif /* !DYNAMIC */
static int do_module_features _((Module m,Feature_enables enablesarr,int flags));
static int do_boot_module _((Module m,Feature_enables enablesarr,int silent));
static int do_cleanup_module _((Module m));
static int modname_ok _((char const*p));
static void autoloadscan _((HashNode hn,int printflags));
static int bin_zmodload_alias _((char*nam,char**args,Options ops));
static int bin_zmodload_exist _((UNUSED(char*nam),char**args,Options ops));
static int bin_zmodload_dep _((UNUSED(char*nam),char**args,Options ops));
static int bin_zmodload_auto _((char*nam,char**args,Options ops));
static int bin_zmodload_load _((char*nam,char**args,Options ops));
static int bin_zmodload_features _((const char*nam,char**args,Options ops));
