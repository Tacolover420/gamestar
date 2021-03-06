import fetchUrl from '../utils/request'
import gameStar from '../utils/gameBank'
import {routerRedux} from "dva/router";
import { Base64 } from 'js-base64';
import Loginjs from '../utils/loginjs'
import {message} from 'antd'
const usermeta=window.localStorage.getItem('usermeta')?JSON.parse(Base64.decode(window.localStorage.getItem('usermeta'))):{}
export default {
    namespace: 'users',
    state: {
        loginUserMeta:usermeta,
        folloing:[],
        currentUserFollow:[],
        currentUserfollowers:[],
        ignore:[],
        login_checkUserName_isHas:false,
        SuggestedPassword:'',
        changeAvterSuccess:true,
        changeAvterFailer:false,
    },
    subscriptions:{
        setup({ dispatch}) {
            dispatch({
                type:'getFollow',
                limit:1000,
                userName:usermeta.userName,
                isloginUser:true,
            }),
            dispatch({
                type:'getIgnore',
                limit:1000,
                userName:usermeta.userName,
                isloginUser:true,
            })
        },
    },
    effects: {
      //验证缓存的数据是否正确
        *checkLocal({},{call,put,select}){
            const {userName} = yield select(state=>state.users.loginUserMeta)
            try{
                if(userName){
                    yield put({
                        type:"fetchLogin",
                        payload:{
                            userName:usermeta.userName,
                            password:usermeta.privePostingWif,
                        }
                    })
                }
            }catch(err){
                
            }
          
        },
      //检查用户是否存在
        *checkUserName({userName},{call,put}){
            try{
                const Result = yield call(fetchUrl,'api/getAccounts',{
                    method:'POST',
                    payload:[[userName]]
                })
                if(Result.length==0){
                    throw "用户名不存在!"
                }
            }catch(err){
                throw err
            }
        },
        // 登陆
      *fetchLogin({ payload }, { call, put }) {
        const {userName}=payload
        try{
            const loginResult = yield call(fetchUrl,'api/getAccounts',{
                method:'POST',
                payload:[[userName]]
            })
            if(loginResult.length==0){
                throw '用户名不存在!'
            }
            const result  = yield  call(Loginjs,payload,loginResult)
            if(result.passwordType=='posting'||result.passwordType=='master'){
                const obj=JSON.stringify({
                    userName:result.userName,
                    privePostingWif:result.privePostingWif,
                    memo_key:result.memo_key
                })
                window.localStorage.setItem('usermeta',Base64.encode(obj));
                yield put({
                    type:'save',
                    payload:{
                        loginUserMeta:result
                    },
                })
                yield put(routerRedux.push("/"))
            }else{
                throw '请输入注册密码或发帖私钥或主私钥'
            }
        }catch(err){
            throw err
        }  
      },
    //   退出
      *clearlocalstor({},{put}){
        window.localStorage.clear()
        yield put({
            type:"save",
            payload:{
                loginUserMeta:{}
            }  
        })
        window.location.href='/'
      },
      //获取屏蔽
      *getIgnore({limit=1000,userName,isloginUser},{call,put,select}){   
         try{
            if(!userName){
                return;
            }
            const ignoreArray = yield call(fetchUrl,'api/getFollowing',{
                method:'POST',
                payload:[userName,"",'ignore',limit]
            })
            const payload=isloginUser?{
                ignore:[...ignoreArray]
            }:null
            yield put({
                type:"save",
                payload
            })
         }catch(err){
             throw err
         }
      },  
      //获取关注
      *getFollow({limit=1000,userName,isloginUser},{call,put,select}){
          try{
            if(!userName){
                return;
            }
            const folloingArray = yield call(fetchUrl,'api/getFollowing',{
                method:'POST',
                payload:[userName,"",'blog',limit]
            })
           let payload = isloginUser?{folloing:folloingArray}:{currentUserFollow:isloginUser?[]:folloingArray}
            yield put({
                type:"save",
                payload
            })
          }catch(err){
              throw err
          }
     },  
     //获取关注者
     *getFollowers({limit=1000,userName,isloginUser},{call,put,select}){
        try{
          if(!userName){
              return;
          }
          const FollowersArray = yield call(fetchUrl,'api/getFollowers',{
              method:'POST',
              payload:[userName,"",'blog',limit]
          })
          yield put({
              type:"save",
              payload:{
                currentUserfollowers:FollowersArray
              }
          })
        }catch(err){
            throw err
        }
    },  
      //生成建议密码
      *CreateSuggestedPassword({},{call,put}){
            const password = gameStar.formatter.createSuggestedPassword();
            yield put({
                type:'save',
                payload:{
                    SuggestedPassword:password
                }
            })
      },
      //修改密码
      *changePassword({payload},{call,put,select}){
          const {aginSuggestedPassword,wif} = payload
          const publicKeys = gameStar.auth.generateKeys('name', aginSuggestedPassword, ['owner', 'active', 'posting', 'memo']);
          const owner = { weight_threshold: 1, account_auths: [], key_auths: [[publicKeys.owner, 1]] };
          const active = { weight_threshold: 1, account_auths: [], key_auths: [[publicKeys.active, 1]] };
          const posting = {weight_threshold: 1, account_auths: [], key_auths: [[publicKeys.posting, 1]] };
          const memoKey=publicKeys.memo;
          const changeResult = yield call(fetchUrl,'broadcast/accountUpdate',{
              method:'POST',
              payload:[wif,'test1',owner,active,posting,memoKey,{}]
          })
      },
    //   签名操作
     *Signtrans({payload},{call,put,select}){
        const {userName}=payload
        const loginResult = yield call(fetchUrl,'api/getAccounts',{
            method:'POST',
            payload:[[userName]]
        })
        if(loginResult.length==0){
            throw '用户未注册'
        }
        const result  = yield  call(Loginjs,payload,loginResult)
        if(result.passwordType=='active' || result.passwordType=='master'){
            yield put({
                type:'save',
                payload:{
                  loginUserMeta:result
                }
            })
            yield put({type:'global/showSignModal'})
            const {doingTask,doingParams} = yield select(state=>state.global)
            if(doingTask){
                yield put({
                    type:doingTask,
                    payload:doingParams
                })
            }
        }else{
             throw '请使用avtive密码/或者主密码'
        }
     },
     *changeAvter({payload},{call,put,select}){
          // 签名权限
          try{
            const {activePriWif,userName} = yield select(state=>state.users.loginUserMeta)
            if(!activePriWif){
               return yield put({
                    type:'global/showSignModal',  
                    payload:{
                        doingTask:'changeAvter',
                        doingParams:payload
                    }
                })
          }
          payload.unshift(activePriWif)
          const changeResult=yield call(fetchUrl,'broadcast/accountUpdate',{
              method:"POST",
              payload
          })
          const StateAccounts = yield select(state=>state.accounts) 
           yield put({
              type:"accounts/save",
              payload:{
                  userAccounts:{
                       ...StateAccounts.userAccounts,
                       json_metadata:changeResult.operations[0][1].json_metadata
                    }  
              }
            })
            yield put({
                type:'save',  
                payload:{
                    changeAvterSuccess:true,
                    changeAvterFailer:false,
                }
            })
            message.success("修改头像成功")
          }catch(err){
            yield put({
                type:'save',  
                payload:{
                    changeAvterSuccess:false,
                    changeAvterFailer:true,
                }
            })
          }
     }
    },
    reducers: {
        save(state, action) {
        return { ...state, ...action.payload}
      },
    },
  }
