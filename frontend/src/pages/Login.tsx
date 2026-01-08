import React from 'react';
import { useNavigate } from 'react-router-dom';

const Login = () => {
    const navigate = useNavigate();

    const handleLogin = (provider: string) => {
        console.log(`Logging in with ${provider}`);
        // TODO: Implement actual auth logic
        navigate('/');
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-blue-50 p-4">
            <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-md text-center">
                <div className="mb-10">
                    <div className="w-24 h-24 bg-blue-400 rounded-full mx-auto mb-4 flex items-center justify-center text-4xl">
                        🎨
                    </div>
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">Magic Sketchbook</h1>
                    <p className="text-gray-500 mb-6">우리 아이 상상력을 키워주는 마법 스케치북</p>

                    <div className="bg-yellow-50 border-2 border-yellow-400 rounded-xl p-4 animate-pulse">
                        <p className="font-bold text-yellow-700">🎁 가입만 해도 고화질 물약 2개를 드려요!</p>
                    </div>
                </div>

                <div className="space-y-4">
                    {/* Google Login */}
                    <button
                        onClick={() => handleLogin('google')}
                        className="w-full bg-white border border-gray-200 text-gray-700 font-bold py-4 rounded-2xl flex items-center justify-center gap-3 hover:bg-gray-50 transition-colors shadow-sm active:scale-95"
                    >
                        <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-6 h-6" />
                        Google로 시작하기
                    </button>

                    {/* Kakao Login */}
                    <button
                        onClick={() => handleLogin('kakao')}
                        className="w-full bg-[#FEE500] text-[#3c1e1e] font-bold py-4 rounded-2xl flex items-center justify-center gap-3 hover:bg-[#fdd835] transition-colors shadow-sm active:scale-95"
                    >
                        <img src="https://www.svgrepo.com/show/353947/kakaotalk.svg" alt="Kakao" className="w-6 h-6" />
                        카카오로 시작하기
                    </button>

                    {/* Naver Login */}
                    <button
                        onClick={() => handleLogin('naver')}
                        className="w-full bg-[#03C75A] text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-3 hover:bg-[#02b351] transition-colors shadow-sm active:scale-95"
                    >
                        <span className="font-black text-xl">N</span>
                        네이버로 시작하기
                    </button>
                </div>

                <p className="mt-8 text-sm text-gray-400">
                    로그인하면 이용약관 및 개인정보처리방침에 동의하게 됩니다.
                </p>
            </div>
        </div>
    );
};

export default Login;
