/* Generated automatically */
static void patadd _((char*add,int ch,long n,int paflags));
static long patcompswitch _((int paren,int*flagp));
static long patcompbranch _((int*flagp,int paren));
static long patcomppiece _((int*flagp,int paren));
static long patcompnot _((int paren,int*flagsp));
static long patnode _((long op));
static void patinsert _((long op,int opnd,char*xtra,int sz));
static void pattail _((long p,long val));
static void patoptail _((long p,long val));
static void patmungestring _((char**string,int*stringlen,int*unmetalenin));
static int patmatch _((Upat prog));
#ifdef MULTIBYTE_SUPPORT
#endif /* MULTIBYTE_SUPPORT */
#ifndef MULTIBYTE_SUPPORT
#endif /* MULTIBYTE_SUPPORT */
static int patrepeat _((Upat p,char*charstart));
