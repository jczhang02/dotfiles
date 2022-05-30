/* Generated automatically */
static void set_list_code _((int p,int type,int cmplx));
static void set_sublist_code _((int p,int type,int flags,int skip,int cmplx));
static void par_list _((int*cmplx));
static void par_list1 _((int*cmplx));
static int par_sublist _((int*cmplx));
static int par_sublist2 _((int*cmplx));
static int par_pline _((int*cmplx));
static int par_cmd _((int*cmplx,int zsh_construct));
static void par_for _((int*cmplx));
static void par_case _((int*cmplx));
static void par_if _((int*cmplx));
static void par_while _((int*cmplx));
static void par_repeat _((int*cmplx));
static void par_subsh _((int*cmplx,int zsh_construct));
static void par_funcdef _((int*cmplx));
static void par_time _((void));
static void par_dinbrack _((void));
static int par_simple _((int*cmplx,int nr));
static int par_redir _((int*rp,char*idstring));
static int par_wordlist _((void));
static int par_nl_wordlist _((void));
static int par_cond _((void));
static int par_cond_1 _((void));
static int par_cond_2 _((void));
static int par_cond_double _((char*a,char*b));
static int get_cond_num _((char*tst));
static int par_cond_triple _((char*a,char*b,char*c));
static int par_cond_multi _((char*a,LinkList l));
static void yyerror _((int noerr));
static Wordcode load_dump_header _((char*nam,char*name,int err));
static int build_dump _((char*nam,char*dump,char**files,int ali,int map,int flags));
static int build_cur_dump _((char*nam,char*dump,char**names,int match,int map,int what));
#if defined(HAVE_SYS_MMAN_H) && defined(HAVE_MMAP) && defined(HAVE_MUNMAP)
#if defined(MAP_SHARED) && defined(PROT_READ)
#define USE_MMAP 1
#endif
#endif
#ifdef USE_MMAP
static int zwcstat _((char*filename,struct stat*buf));
#endif
static Eprog check_dump_file _((char*file,struct stat*sbuf,char*name,int*ksh,int test_only));
static void freedump _((FuncDump f));
